import { Router } from "express";
import { db, usersTable, streamsTable, teamsTable, teamManagersTable } from "@workspace/db";
import { and, eq, inArray, or } from "drizzle-orm";
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
import { enrichUser, enrichUsers, toPublicUser, type SafeUser } from "../lib/safeUser";
import type { Principal } from "../lib/auth";
import type { User } from "@workspace/db";

const router = Router();
const GetUserParams = z.object({ id: z.string() });

/**
 * Normalise the CreateUserBody / UpdateUserRoleBody team scope so both the
 * legacy single `teamId` and the new `teamIds` array converge into one
 * canonical set of teams.
 */
function resolveTeamIds(body: {
  teamId?: string | null;
  teamIds?: string[] | undefined;
}): string[] {
  const fromArray = body.teamIds ?? [];
  const fromSingle = body.teamId ? [body.teamId] : [];
  return Array.from(new Set([...fromArray, ...fromSingle]));
}

/**
 * Returns true when `actor` may manage (create/update/delete/activate) the
 * given target user record. Admin can touch anyone. Programme overseers
 * can manage non-admin/non-PO users whose programme matches theirs.
 */
async function actorCanManageUser(
  actor: Principal,
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
 * True when `actor` may attach the new user shell into the given scope.
 * Validates teamIds chain to actor's programme for non-admins.
 */
async function actorCanCreateUser(
  actor: Principal,
  target: {
    role: typeof usersTable.$inferSelect.role;
    programmeId: string | null;
    streamId: string | null;
    teamIds: string[];
  },
): Promise<boolean> {
  if (actor.role === "admin") return true;
  if (actor.role !== "programme_overseer") return false;
  if (!actor.programmeId) return false;
  if (target.role === "admin" || target.role === "programme_overseer") return false;

  if (!target.programmeId && !target.streamId && target.teamIds.length === 0) return false;
  if (target.programmeId && target.programmeId !== actor.programmeId) return false;
  if (target.streamId) {
    const [s] = await db
      .select({ programmeId: streamsTable.programmeId })
      .from(streamsTable)
      .where(eq(streamsTable.id, target.streamId))
      .limit(1);
    if (!s || s.programmeId !== actor.programmeId) return false;
  }
  if (target.teamIds.length > 0) {
    const teamRows = await db
      .select({ id: teamsTable.id, streamId: teamsTable.streamId })
      .from(teamsTable)
      .where(inArray(teamsTable.id, target.teamIds));
    if (teamRows.length !== target.teamIds.length) return false;
    const streamIds = Array.from(new Set(teamRows.map((t) => t.streamId).filter((s): s is string => !!s)));
    if (streamIds.length === 0) return false;
    const streamRows = await db
      .select({ id: streamsTable.id, programmeId: streamsTable.programmeId })
      .from(streamsTable)
      .where(inArray(streamsTable.id, streamIds));
    for (const s of streamRows) {
      if (s.programmeId !== actor.programmeId) return false;
    }
  }
  return true;
}

async function setUserTeamManagers(
  userId: string,
  role: typeof usersTable.$inferSelect.role,
  teamIds: string[],
): Promise<void> {
  // Only leader / team_admin users get team_managers rows. For other roles
  // (admin / overseers) we clear any leftover assignments.
  await db.delete(teamManagersTable).where(eq(teamManagersTable.userId, userId));
  if (teamIds.length === 0) return;
  if (role !== "leader" && role !== "team_admin") return;
  await db.insert(teamManagersTable).values(
    teamIds.map((teamId) => ({ teamId, userId, role: role as "leader" | "team_admin" })),
  );
}

router.post("/users", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { email, name, password, role, department, programmeId, streamId } = parsed.data;
  const teamIds = resolveTeamIds(parsed.data);
  const actor = req.authUser!;

  const allowed = await actorCanCreateUser(actor, {
    role,
    programmeId: programmeId ?? null,
    streamId: streamId ?? null,
    teamIds,
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

  const created = await db.transaction(async (tx) => {
    const [user] = await tx
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
        active: true,
        invitedByName: actor.name,
      })
      .returning();
    if (teamIds.length > 0 && (role === "leader" || role === "team_admin")) {
      await tx.insert(teamManagersTable).values(
        teamIds.map((teamId) => ({ teamId, userId: user.id, role: role as "leader" | "team_admin" })),
      );
    }
    return user;
  });

  req.log.info({ userId: created.id, by: actor.id }, "User created");
  res.status(201).json(await enrichUser(created));
});

// GET /users — admins see everyone; non-admins see scoped users.
router.get("/users", requireAuth, async (req, res): Promise<void> => {
  const me = req.authUser!;
  if (me.role === "admin") {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    res.json(await enrichUsers(users));
    return;
  }

  const visible = await visibleTeamIdsFor(me);
  const teamIds = visible === "all" ? [] : visible;

  // Always include the requester themselves so the client can resolve "me".
  const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof inArray>> = [eq(usersTable.id, me.id)];

  // Find users tied to teams via team_managers.
  if (teamIds.length > 0) {
    const teamUserRows = await db
      .select({ userId: teamManagersTable.userId })
      .from(teamManagersTable)
      .where(inArray(teamManagersTable.teamId, teamIds));
    const userIds = Array.from(new Set(teamUserRows.map((r) => r.userId)));
    if (userIds.length > 0) conditions.push(inArray(usersTable.id, userIds));
  }
  if (me.role === "stream_overseer" && me.streamId) {
    conditions.push(eq(usersTable.streamId, me.streamId));
  }
  if (me.role === "programme_overseer" && me.programmeId) {
    conditions.push(eq(usersTable.programmeId, me.programmeId));
    const streamRows = await db
      .select({ id: streamsTable.id })
      .from(streamsTable)
      .where(eq(streamsTable.programmeId, me.programmeId));
    const streamIds = streamRows.map((s) => s.id);
    if (streamIds.length > 0) conditions.push(inArray(usersTable.streamId, streamIds));
  }

  const rows = await db
    .select()
    .from(usersTable)
    .where(or(...conditions))
    .orderBy(usersTable.createdAt);

  const enriched = await enrichUsers(rows);
  res.json(enriched.map((u) => (u.id === me.id ? u : toPublicUser(u))));
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const me = req.authUser!;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const safe = await enrichUser(user);

  if (me.role === "admin" || user.id === me.id) {
    res.json(safe);
    return;
  }

  // Non-admin: only allow lookup of users that share a visible team OR live
  // in the same stream/programme as the caller. Treat out-of-scope users
  // as 404 to avoid existence leak.
  const visible = await visibleTeamIdsFor(me);
  let teamMatch = false;
  if (visible !== "all") {
    teamMatch =
      safe.leaderTeamIds.some((t) => visible.includes(t)) ||
      safe.teamAdminTeamIds.some((t) => visible.includes(t));
  }
  const streamMatch =
    me.role === "stream_overseer" && !!me.streamId && user.streamId === me.streamId;

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

  res.json(toPublicUser(safe));
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

  const canCurrent = await actorCanManageUser(actor, target);
  if (!canCurrent) {
    res.status(403).json({ error: "You do not have permission to change that user" });
    return;
  }
  if (
    actor.role !== "admin" &&
    (parsed.data.role === "admin" || parsed.data.role === "programme_overseer")
  ) {
    res.status(403).json({ error: "You cannot grant that role" });
    return;
  }

  const teamIds = "teamIds" in parsed.data || "teamId" in parsed.data
    ? resolveTeamIds(parsed.data)
    : null;

  const nextScope = {
    role: parsed.data.role,
    programmeId:
      "programmeId" in parsed.data ? parsed.data.programmeId ?? null : target.programmeId,
    streamId: "streamId" in parsed.data ? parsed.data.streamId ?? null : target.streamId,
    teamIds: teamIds ?? [],
  };
  const canNext = await actorCanCreateUser(actor, nextScope);
  if (!canNext) {
    res.status(403).json({ error: "Target scope is outside your authority" });
    return;
  }

  const patch: Partial<typeof usersTable.$inferInsert> = { role: parsed.data.role };
  if ("programmeId" in parsed.data) patch.programmeId = parsed.data.programmeId ?? null;
  if ("streamId" in parsed.data) patch.streamId = parsed.data.streamId ?? null;

  const updated = await db.transaction(async (tx) => {
    const [user] = await tx
      .update(usersTable)
      .set(patch)
      .where(eq(usersTable.id, id))
      .returning();
    if (!user) return null;
    // If team scope was specified — or the role moved out of the manager
    // tiers — sync team_managers rows.
    if (teamIds !== null) {
      await tx.delete(teamManagersTable).where(eq(teamManagersTable.userId, id));
      if (teamIds.length > 0 && (parsed.data.role === "leader" || parsed.data.role === "team_admin")) {
        await tx.insert(teamManagersTable).values(
          teamIds.map((teamId) => ({ teamId, userId: id, role: parsed.data.role as "leader" | "team_admin" })),
        );
      }
    } else if (parsed.data.role !== "leader" && parsed.data.role !== "team_admin") {
      await tx.delete(teamManagersTable).where(eq(teamManagersTable.userId, id));
    }
    return user;
  });

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  req.log.info({ targetId: id, role: parsed.data.role, by: actor.id }, "Role updated");
  res.json(await enrichUser(updated));
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
  res.json(await enrichUser(user));
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
  res.json(await enrichUser(user));
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
