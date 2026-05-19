import { Router } from "express";
import {
  db,
  teamsTable,
  personnelTable,
  streamsTable,
  teamManagersTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  CreateTeamBody,
  UpdateTeamBody,
  AddTeamManagerBody,
  CreateTeamMemberBody,
  UpdateMemberBody,
} from "@workspace/api-zod";
import { z } from "zod";
import { requireAuth, requireManager } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";
import {
  userCanAccessTeam,
  userCanAccessStream,
  userCanAssignAsManager,
  userCanManageTeamLeaders,
  userCanManageTeamAdmins,
  visibleTeamIdsFor,
  getTeamManagersByTeam,
} from "../lib/permissions";

const router = Router();

const IdParam = z.object({ id: z.string() });
const ManagerParams = z.object({ id: z.string(), userId: z.string() });

type TeamRow = {
  id: string;
  name: string;
  streamId: string | null;
  functionLabel: string | null;
  createdAt: Date;
  updatedAt: Date;
  streamName?: string | null;
};

async function attachManagers<T extends { id: string }>(
  rows: T[],
): Promise<(T & { leaderIds: string[]; teamAdminIds: string[] })[]> {
  if (rows.length === 0) return [];
  const map = await getTeamManagersByTeam(rows.map((r) => r.id));
  return rows.map((r) => {
    const entry = map.get(r.id) ?? { leaderIds: [], teamAdminIds: [] };
    return { ...r, leaderIds: entry.leaderIds, teamAdminIds: entry.teamAdminIds };
  });
}

const teamSelect = {
  id: teamsTable.id,
  name: teamsTable.name,
  streamId: teamsTable.streamId,
  functionLabel: teamsTable.functionLabel,
  createdAt: teamsTable.createdAt,
  updatedAt: teamsTable.updatedAt,
};

const teamSelectWithStream = {
  ...teamSelect,
  streamName: streamsTable.name,
};

// GET /teams
router.get("/teams", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const visibleIds = await visibleTeamIdsFor(user);

  let teams: TeamRow[] = [];
  if (visibleIds === "all") {
    teams = await db
      .select(teamSelectWithStream)
      .from(teamsTable)
      .leftJoin(streamsTable, eq(teamsTable.streamId, streamsTable.id))
      .orderBy(teamsTable.name);
  } else if (visibleIds.length > 0) {
    teams = await db
      .select(teamSelectWithStream)
      .from(teamsTable)
      .leftJoin(streamsTable, eq(teamsTable.streamId, streamsTable.id))
      .where(inArray(teamsTable.id, visibleIds))
      .orderBy(teamsTable.name);
  }
  res.json(await attachManagers(teams));
});

// GET /teams/:id
router.get("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;
  if (!(await userCanAccessTeam(user, params.data.id))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const [team] = await db
    .select(teamSelectWithStream)
    .from(teamsTable)
    .leftJoin(streamsTable, eq(teamsTable.streamId, streamsTable.id))
    .where(eq(teamsTable.id, params.data.id))
    .limit(1);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  const [enriched] = await attachManagers([team]);
  res.json(enriched);
});

// POST /teams — admin or overseer of the target stream
router.post("/teams", requireManager, async (req, res): Promise<void> => {
  const parsed = CreateTeamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, streamId, leaderIds, functionLabel } = parsed.data;
  const user = req.authUser!;

  // Only admins, programme_overseers, and stream_overseers may create teams.
  if (user.role !== "admin" && user.role !== "programme_overseer" && user.role !== "stream_overseer") {
    res.status(403).json({ error: "You cannot create teams" });
    return;
  }
  // Non-admins must scope the new team to a stream they oversee.
  if (user.role !== "admin") {
    if (!streamId || !(await userCanAccessStream(user, streamId))) {
      res.status(403).json({ error: "You can only create teams within your own stream" });
      return;
    }
  }

  const [team] = await db
    .insert(teamsTable)
    .values({ name, streamId: streamId ?? null, functionLabel })
    .returning();

  const dedupedLeaderIds = Array.from(new Set(leaderIds ?? []));
  if (dedupedLeaderIds.length > 0) {
    for (const leaderId of dedupedLeaderIds) {
      const check = await userCanAssignAsManager(
        user,
        leaderId,
        team.id,
        streamId ?? null,
        "leader",
      );
      if (!check.ok) {
        // Rollback the freshly-created team so we don't leave it orphaned.
        await db.delete(teamsTable).where(eq(teamsTable.id, team.id));
        res.status(check.status).json({ error: check.error });
        return;
      }
    }
    await db.insert(teamManagersTable).values(
      dedupedLeaderIds.map((userId) => ({ teamId: team.id, userId, role: "leader" as const })),
    );
  }

  await logActivity({ user, actionType: "create", entityType: "team", entityId: team.id, entityTitle: team.name });
  const [enriched] = await attachManagers([team]);
  res.status(201).json(enriched);
});

// PATCH /teams/:id — admin or manager of this team
router.patch("/teams/:id", requireManager, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;

  if (!(await userCanAccessTeam(user, params.data.id))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = UpdateTeamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Non-admins cannot reparent a team into a different stream.
  if (user.role !== "admin" && "streamId" in parsed.data) {
    if (!(await userCanAccessStream(user, parsed.data.streamId ?? null))) {
      res.status(403).json({ error: "You cannot move teams outside your stream" });
      return;
    }
  }

  const patch: Partial<typeof teamsTable.$inferInsert> = {};
  if ("name" in parsed.data) patch.name = parsed.data.name;
  if ("streamId" in parsed.data) patch.streamId = parsed.data.streamId ?? null;
  if ("functionLabel" in parsed.data) patch.functionLabel = parsed.data.functionLabel;

  const [team] = await db.update(teamsTable).set(patch).where(eq(teamsTable.id, params.data.id)).returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  await logActivity({ user, actionType: "update", entityType: "team", entityId: team.id, entityTitle: team.name });
  const [enriched] = await attachManagers([team]);
  res.json(enriched);
});

// DELETE /teams/:id — admin or overseer of the team's stream
router.delete("/teams/:id", requireManager, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;

  // Leaders and team_admins cannot delete their own team — only an overseer/admin can.
  if (user.role === "leader" || user.role === "team_admin") {
    res.status(403).json({ error: "Only overseers or admins can delete a team" });
    return;
  }
  if (!(await userCanAccessTeam(user, params.data.id))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const [team] = await db.delete(teamsTable).where(eq(teamsTable.id, params.data.id)).returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  await logActivity({ user, actionType: "delete", entityType: "team", entityId: params.data.id, entityTitle: team.name });
  res.sendStatus(204);
});

// POST /teams/:id/managers — add a leader or team_admin
router.post("/teams/:id/managers", requireManager, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const teamId = params.data.id;
  const user = req.authUser!;

  const parsed = AddTeamManagerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { userId: targetUserId, role: managerRole } = parsed.data;

  const allowed =
    managerRole === "leader"
      ? await userCanManageTeamLeaders(user, teamId)
      : await userCanManageTeamAdmins(user, teamId);
  if (!allowed) { res.status(403).json({ error: "Access denied" }); return; }

  const [team] = await db
    .select(teamSelect)
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId))
    .limit(1);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const check = await userCanAssignAsManager(
    user,
    targetUserId,
    teamId,
    team.streamId,
    managerRole,
  );
  if (!check.ok) { res.status(check.status).json({ error: check.error }); return; }

  // Upsert: a user can hold only one role per team. If they already have a
  // row, update its role to the new value (e.g. promoting team_admin → leader).
  await db
    .insert(teamManagersTable)
    .values({ teamId, userId: targetUserId, role: managerRole })
    .onConflictDoUpdate({
      target: [teamManagersTable.teamId, teamManagersTable.userId],
      set: { role: managerRole },
    });

  await logActivity({
    user,
    actionType: "update",
    entityType: "team",
    entityId: teamId,
    entityTitle: team.name,
    teamId,
  });

  const [enriched] = await attachManagers([team]);
  res.json(enriched);
});

// DELETE /teams/:id/managers/:userId — remove a manager
router.delete("/teams/:id/managers/:userId", requireManager, async (req, res): Promise<void> => {
  const params = ManagerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const { id: teamId, userId: targetUserId } = params.data;
  const user = req.authUser!;

  const [existing] = await db
    .select({ role: teamManagersTable.role })
    .from(teamManagersTable)
    .where(
      and(
        eq(teamManagersTable.teamId, teamId),
        eq(teamManagersTable.userId, targetUserId),
      ),
    )
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Manager not found" }); return; }

  const allowed =
    existing.role === "leader"
      ? await userCanManageTeamLeaders(user, teamId)
      : await userCanManageTeamAdmins(user, teamId);
  if (!allowed) { res.status(403).json({ error: "Access denied" }); return; }

  await db
    .delete(teamManagersTable)
    .where(
      and(
        eq(teamManagersTable.teamId, teamId),
        eq(teamManagersTable.userId, targetUserId),
      ),
    );

  const [team] = await db
    .select(teamSelect)
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId))
    .limit(1);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  await logActivity({
    user,
    actionType: "update",
    entityType: "team",
    entityId: teamId,
    entityTitle: team.name,
    teamId,
  });

  const [enriched] = await attachManagers([team]);
  res.json(enriched);
});

// ─── Members (assigned_personnel) ─────────────────────────────────────────

// GET /teams/:id/members
router.get("/teams/:id/members", requireAuth, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const teamId = params.data.id;
  const user = req.authUser!;

  if (!(await userCanAccessTeam(user, teamId))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const members = await db
    .select()
    .from(personnelTable)
    .where(eq(personnelTable.teamId, teamId))
    .orderBy(personnelTable.name);
  res.json(members);
});

// POST /teams/:id/members
router.post("/teams/:id/members", requireManager, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const teamId = params.data.id;
  const user = req.authUser!;

  if (!(await userCanAccessTeam(user, teamId))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = CreateTeamMemberBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [member] = await db.insert(personnelTable).values({ ...parsed.data, teamId }).returning();
  await logActivity({ user, actionType: "create", entityType: "member", entityId: member.id, entityTitle: member.name, teamId });
  res.status(201).json(member);
});

// PATCH /members/:id
router.patch("/members/:id", requireManager, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const id = params.data.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(personnelTable).where(eq(personnelTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await userCanAccessTeam(user, existing.teamId))) { res.status(403).json({ error: "Access denied" }); return; }

  const parsed = UpdateMemberBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [member] = await db.update(personnelTable).set(parsed.data).where(eq(personnelTable.id, id)).returning();
  res.json(member);
});

// DELETE /members/:id
router.delete("/members/:id", requireManager, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const id = params.data.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(personnelTable).where(eq(personnelTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await userCanAccessTeam(user, existing.teamId))) { res.status(403).json({ error: "Access denied" }); return; }

  await db.delete(personnelTable).where(eq(personnelTable.id, id));
  await logActivity({ user, actionType: "delete", entityType: "member", entityId: id, entityTitle: existing.name });
  res.sendStatus(204);
});

export default router;
