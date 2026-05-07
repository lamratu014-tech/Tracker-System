import { Router } from "express";
import { db, usersTable, streamsTable, teamsTable } from "@workspace/db";
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
import { requireAuth } from "../middlewares/requireAuth";
import { hashPassword } from "../lib/auth";
import { visibleTeamIdsFor } from "../lib/permissions";
import type { User } from "@workspace/db";

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
    programmeId: u.programmeId,
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

/**
 * Returns true when `actor` may manage (create/update/delete/activate) the
 * given target user record. Admin can touch anyone. Programme overseers
 * can manage non-admin/non-PO users whose programme matches theirs (either
 * directly or via stream→programme). Anyone else: false.
 *
 * `actor` may not act on themselves (caller enforces that separately).
 */
async function actorCanManageUser(
  actor: User,
  target: { role: typeof usersTable.$inferSelect.role; programmeId: string | null; streamId: string | null },
): Promise<boolean> {
  if (actor.role === "admin") return true;
  if (actor.role !== "programme_overseer") return false;
  if (!actor.programmeId) return false;
  if (target.role === "admin" || target.role === "programme_overseer") return false;
  if (target.programmeId === actor.programmeId) return true;
  if (target.streamId) {
    const [s] = await db
      .select({ programmeId: streamsTable.programmeId })
      .from(streamsTable)
      .where(eq(streamsTable.id, target.streamId))
      .limit(1);
    return !!s && s.programmeId === actor.programmeId;
  }
  return false;
}

/**
 * Returns true when `actor` may *create* a user shell with the given target
 * scope. Admins always; programme overseers when target role is non-admin/
 * non-PO and the target scope (programmeId/streamId/teamId) lies inside
 * their programme.
 */
async function actorCanCreateUser(
  actor: User,
  target: {
    role: typeof usersTable.$inferSelect.role;
    programmeId: string | null;
    streamId: string | null;
    teamId: string | null;
  },
): Promise<boolean> {
  if (actor.role === "admin") return true;
  if (actor.role !== "programme_overseer") return false;
  if (!actor.programmeId) return false;
  if (target.role === "admin" || target.role === "programme_overseer") return false;

  // Resolve which programme the new user would belong to.
  if (target.programmeId && target.programmeId !== actor.programmeId) return false;
  if (target.streamId) {
    const [s] = await db
      .select({ programmeId: streamsTable.programmeId })
      .from(streamsTable)
      .where(eq(streamsTable.id, target.streamId))
      .limit(1);
    if (!s || s.programmeId !== actor.programmeId) return false;
  }
  // Validate teamId scope by chaining team -> stream -> programme. A PO
  // must not be able to attach a user to a team outside their programme,
  // even when programmeId/streamId are omitted from the payload.
  if (target.teamId) {
    const [t] = await db
      .select({ streamId: teamsTable.streamId })
      .from(teamsTable)
      .where(eq(teamsTable.id, target.teamId))
      .limit(1);
    if (!t?.streamId) return false;
    const [ts] = await db
      .select({ programmeId: streamsTable.programmeId })
      .from(streamsTable)
      .where(eq(streamsTable.id, t.streamId))
      .limit(1);
    if (!ts || ts.programmeId !== actor.programmeId) return false;
  }
  return true;
}

router.post("/users", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { email, name, password, role, department, programmeId, streamId, teamId } = parsed.data;
  const actor = req.authUser!;

  const allowed = await actorCanCreateUser(actor, {
    role,
    programmeId: programmeId ?? null,
    streamId: streamId ?? null,
    teamId: teamId ?? null,
  });
  if (!allowed) {
    res.status(403).json({ error: "You do not have permission to create that user" });
    return;
  }

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
      programmeId: programmeId ?? null,
      streamId: streamId ?? null,
      teamId: teamId ?? null,
      active: true,
      invitedByName: actor.name,
    })
    .returning();

  req.log.info({ userId: user!.id, by: actor.id }, "User created");
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
  if (me.role === "programme_overseer" && me.programmeId) {
    // Include programme overseers, stream overseers in this programme,
    // and leaders inside teams in this programme. The teamIds branch
    // above already covers leader+member rows; add programme/stream
    // matches here.
    conditions.push(eq(usersTable.programmeId, me.programmeId));
    const streamRows = await db
      .select({ id: streamsTable.id })
      .from(streamsTable)
      .where(eq(streamsTable.programmeId, me.programmeId));
    const streamIds = streamRows.map((s) => s.id);
    if (streamIds.length > 0) {
      conditions.push(inArray(usersTable.streamId, streamIds));
    }
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

  let programmeMatch = false;
  if (me.role === "programme_overseer" && me.programmeId) {
    if (user.programmeId === me.programmeId) {
      programmeMatch = true;
    } else if (user.streamId) {
      const [s] = await db
        .select({ programmeId: streamsTable.programmeId })
        .from(streamsTable)
        .where(eq(streamsTable.id, user.streamId))
        .limit(1);
      programmeMatch = !!s && s.programmeId === me.programmeId;
    }
  }

  if (!teamMatch && !streamMatch && !programmeMatch) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(publicUser(user));
});

router.patch("/users/:id/role", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateUserRoleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const id = params.data.id;
  const actor = req.authUser!;

  if (id === actor.id) {
    res.status(400).json({ error: "You cannot change your own role" });
    return;
  }

  const parsed = UpdateUserRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Authorization: actor must be allowed to manage the *current* target,
  // and (if changing scope) also the *new* scope.
  const canCurrent = await actorCanManageUser(actor, target);
  if (!canCurrent) {
    res.status(403).json({ error: "You do not have permission to change that user" });
    return;
  }
  // Block role escalation to admin/PO by non-admins.
  if (
    actor.role !== "admin" &&
    (parsed.data.role === "admin" || parsed.data.role === "programme_overseer")
  ) {
    res.status(403).json({ error: "You cannot grant that role" });
    return;
  }
  const nextScope = {
    role: parsed.data.role,
    programmeId:
      "programmeId" in parsed.data ? parsed.data.programmeId ?? null : target.programmeId,
    streamId: "streamId" in parsed.data ? parsed.data.streamId ?? null : target.streamId,
    teamId: "teamId" in parsed.data ? parsed.data.teamId ?? null : target.teamId,
  };
  const canNext = await actorCanCreateUser(actor, nextScope);
  if (!canNext) {
    res.status(403).json({ error: "Target scope is outside your authority" });
    return;
  }

  // Build patch so explicit `null` clears the FK while omitted keys leave
  // the existing value untouched.
  const patch: Partial<typeof usersTable.$inferInsert> = { role: parsed.data.role };
  if ("programmeId" in parsed.data) patch.programmeId = parsed.data.programmeId ?? null;
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

  req.log.info({ targetId: id, role: parsed.data.role, by: actor.id }, "Role updated");
  res.json(safeUser(user));
});

router.patch("/users/:id/deactivate", requireAuth, async (req, res): Promise<void> => {
  const params = DeactivateUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const id = params.data.id;
  const actor = req.authUser!;

  if (id === actor.id) {
    res.status(400).json({ error: "You cannot deactivate your own account" });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  if (!(await actorCanManageUser(actor, target))) {
    res.status(403).json({ error: "You do not have permission to deactivate that user" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ active: false })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  req.log.info({ targetId: id, by: actor.id }, "User deactivated");
  res.json(safeUser(user));
});

router.patch("/users/:id/reactivate", requireAuth, async (req, res): Promise<void> => {
  const params = ReactivateUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const id = params.data.id;
  const actor = req.authUser!;

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  if (!(await actorCanManageUser(actor, target))) {
    res.status(403).json({ error: "You do not have permission to reactivate that user" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ active: true })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  req.log.info({ targetId: id, by: actor.id }, "User reactivated");
  res.json(safeUser(user));
});

router.delete("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const id = params.data.id;
  const actor = req.authUser!;

  if (id === actor.id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  if (!(await actorCanManageUser(actor, target))) {
    res.status(403).json({ error: "You do not have permission to delete that user" });
    return;
  }

  const [user] = await db
    .delete(usersTable)
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  req.log.info({ targetId: id, by: actor.id }, "User deleted");
  res.sendStatus(204);
});

export default router;
