import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, or, inArray } from "drizzle-orm";
import {
  CreateUserBody,
  UpdateUserRoleBody,
  UpdateUserRoleParams,
  DeactivateUserParams,
  ReactivateUserParams,
  DeleteUserParams,
} from "@workspace/api-zod";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middlewares/requireAuth";
import { hashPassword } from "../lib/auth";
import { visibleTeamIdsFor } from "../lib/permissions";

const router = Router();

const GetUserParams = z.object({ id: z.string() });

function safeUser(u: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...rest } = u;
  return rest;
}

/**
 * Strip directory-style fields (email, department, invitedByName, active,
 * timestamps) for non-admin viewers so a leader/overseer who needs to render
 * names doesn't get the full HR-style profile.
 */
function publicUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    initials: u.initials,
    role: u.role,
    streamId: u.streamId,
    teamId: u.teamId,
    email: "",
    department: "",
    invitedByName: "",
    active: u.active,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

router.post("/users", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { email, name, password, role, department, streamId, teamId } = parsed.data;

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase(),
      name,
      initials,
      passwordHash,
      role,
      department: department ?? "",
      streamId: streamId ?? null,
      teamId: teamId ?? null,
      active: true,
      invitedByName: req.authUser!.name,
    })
    .returning();

  req.log.info({ userId: user!.id }, "User created directly by admin");
  res.status(201).json(safeUser(user!));
});

// GET /users — admins see the full directory; non-admins see only the users
// scoped to teams they manage, with sensitive fields stripped.
router.get("/users", requireAuth, async (req, res): Promise<void> => {
  const me = req.authUser!;
  if (me.role === "admin") {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    res.json(users.map(safeUser));
    return;
  }

  const visible = await visibleTeamIdsFor(me);
  const teamIds = visible === "all" ? [] : visible;

  // Always include the requester themselves so the client can resolve "me".
  const conditions = [eq(usersTable.id, me.id)];
  if (teamIds.length > 0) conditions.push(inArray(usersTable.teamId, teamIds));
  if (me.role === "stream_overseer" && me.streamId) {
    conditions.push(eq(usersTable.streamId, me.streamId));
  }

  const rows = await db
    .select()
    .from(usersTable)
    .where(or(...conditions))
    .orderBy(usersTable.createdAt);

  res.json(rows.map((u) => (u.id === me.id ? safeUser(u) : publicUser(u))));
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const me = req.authUser!;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (me.role === "admin" || user.id === me.id) {
    res.json(safeUser(user));
    return;
  }

  // Non-admin: only allow lookup of users in a team or stream the requester
  // can see. Treat out-of-scope users as 404 to avoid existence-leak.
  const visible = await visibleTeamIdsFor(me);
  const teamMatch = visible !== "all" && user.teamId && visible.includes(user.teamId);
  const streamMatch =
    me.role === "stream_overseer" && me.streamId && user.streamId === me.streamId;
  if (!teamMatch && !streamMatch) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(publicUser(user));
});

router.patch("/users/:id/role", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateUserRoleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const id = params.data.id;

  if (id === req.authUser!.id) {
    res.status(400).json({ error: "You cannot change your own role" });
    return;
  }

  const parsed = UpdateUserRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Build patch so explicit `null` clears the FK while omitted keys leave
  // the existing value untouched.
  const patch: Partial<typeof usersTable.$inferInsert> = { role: parsed.data.role };
  if ("streamId" in parsed.data) patch.streamId = parsed.data.streamId ?? null;
  if ("teamId" in parsed.data) patch.teamId = parsed.data.teamId ?? null;

  const [user] = await db
    .update(usersTable)
    .set(patch)
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  req.log.info({ targetId: id, role: parsed.data.role }, "Role updated");
  res.json(safeUser(user));
});

router.patch("/users/:id/deactivate", requireAdmin, async (req, res): Promise<void> => {
  const params = DeactivateUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const id = params.data.id;

  if (id === req.authUser!.id) {
    res.status(400).json({ error: "You cannot deactivate your own account" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ active: false })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  req.log.info({ targetId: id }, "User deactivated");
  res.json(safeUser(user));
});

router.patch("/users/:id/reactivate", requireAdmin, async (req, res): Promise<void> => {
  const params = ReactivateUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const id = params.data.id;

  const [user] = await db
    .update(usersTable)
    .set({ active: true })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  req.log.info({ targetId: id }, "User reactivated");
  res.json(safeUser(user));
});

router.delete("/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const id = params.data.id;

  if (id === req.authUser!.id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  const [user] = await db
    .delete(usersTable)
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  req.log.info({ targetId: id }, "User deleted");
  res.sendStatus(204);
});

export default router;
