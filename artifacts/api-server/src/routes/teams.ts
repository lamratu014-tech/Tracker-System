import { Router } from "express";
import { db, teamsTable, personnelTable, usersTable, streamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateTeamBody,
  UpdateTeamBody,
  AssignTeamLeaderBody,
  CreateTeamMemberBody,
  UpdateMemberBody,
} from "@workspace/api-zod";
import { z } from "zod";
import { requireAuth, requireManager } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";
import { userCanAccessTeam, userCanAccessStream, userCanAssignAsLeader } from "../lib/permissions";

const router = Router();

const IdParam = z.object({ id: z.string() });

// GET /teams
router.get("/teams", requireAuth, async (_req, res): Promise<void> => {
  const teams = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      streamId: teamsTable.streamId,
      leaderId: teamsTable.leaderId,
      functionLabel: teamsTable.functionLabel,
      createdAt: teamsTable.createdAt,
      updatedAt: teamsTable.updatedAt,
      streamName: streamsTable.name,
    })
    .from(teamsTable)
    .leftJoin(streamsTable, eq(teamsTable.streamId, streamsTable.id))
    .orderBy(teamsTable.name);
  res.json(teams);
});

// GET /teams/:id
router.get("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [team] = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      streamId: teamsTable.streamId,
      leaderId: teamsTable.leaderId,
      functionLabel: teamsTable.functionLabel,
      createdAt: teamsTable.createdAt,
      updatedAt: teamsTable.updatedAt,
      streamName: streamsTable.name,
    })
    .from(teamsTable)
    .leftJoin(streamsTable, eq(teamsTable.streamId, streamsTable.id))
    .where(eq(teamsTable.id, params.data.id))
    .limit(1);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  res.json(team);
});

// POST /teams — admin or overseer of the target stream
router.post("/teams", requireManager, async (req, res): Promise<void> => {
  const parsed = CreateTeamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, streamId, leaderId, functionLabel } = parsed.data;
  const user = req.authUser!;

  // Non-admins must scope the new team to a stream they oversee.
  if (user.role !== "admin") {
    if (!streamId || !userCanAccessStream(user, streamId)) {
      res.status(403).json({ error: "You can only create teams within your own stream" });
      return;
    }
  }

  // If a leader is being installed at create time, validate the target
  // user is in scope (target's stream matches; not an admin) for non-admins.
  if (leaderId) {
    const check = await userCanAssignAsLeader(user, leaderId, streamId ?? null);
    if (!check.ok) { res.status(check.status).json({ error: check.error }); return; }
  }

  const [team] = await db
    .insert(teamsTable)
    .values({ name, streamId: streamId ?? null, leaderId: leaderId ?? null, functionLabel })
    .returning();
  await logActivity({ user, actionType: "create", entityType: "team", entityId: team.id, entityTitle: team.name });
  res.status(201).json(team);
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
    if (!userCanAccessStream(user, parsed.data.streamId ?? null)) {
      res.status(403).json({ error: "You cannot move teams outside your stream" });
      return;
    }
  }

  // Leaders cannot reassign leadership of their own team via PATCH;
  // assignment must go through the dedicated /assign-leader route which
  // enforces the same admin/overseer-only rule.
  if (user.role === "leader" && "leaderId" in parsed.data) {
    res.status(403).json({ error: "Team leaders cannot reassign team leaders" });
    return;
  }

  // For non-admins, validate any new leaderId against the resolved stream
  // of the team (post-patch streamId if changing, otherwise existing one).
  if ("leaderId" in parsed.data && parsed.data.leaderId) {
    const [existingTeam] = await db
      .select({ streamId: teamsTable.streamId })
      .from(teamsTable)
      .where(eq(teamsTable.id, params.data.id))
      .limit(1);
    const targetStreamId =
      "streamId" in parsed.data ? parsed.data.streamId ?? null : existingTeam?.streamId ?? null;
    const check = await userCanAssignAsLeader(user, parsed.data.leaderId, targetStreamId);
    if (!check.ok) { res.status(check.status).json({ error: check.error }); return; }
  }

  // Preserve the difference between "key omitted" (don't touch) and "key=null" (clear).
  const patch: Partial<typeof teamsTable.$inferInsert> = {};
  if ("name" in parsed.data) patch.name = parsed.data.name;
  if ("streamId" in parsed.data) patch.streamId = parsed.data.streamId ?? null;
  if ("leaderId" in parsed.data) patch.leaderId = parsed.data.leaderId ?? null;
  if ("functionLabel" in parsed.data) patch.functionLabel = parsed.data.functionLabel;

  const [team] = await db.update(teamsTable).set(patch).where(eq(teamsTable.id, params.data.id)).returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  await logActivity({ user, actionType: "update", entityType: "team", entityId: team.id, entityTitle: team.name });
  res.json(team);
});

// DELETE /teams/:id — admin or overseer of the team's stream
router.delete("/teams/:id", requireManager, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;

  // Leaders cannot delete their own team — only an overseer/admin can.
  if (user.role === "leader") {
    res.status(403).json({ error: "Team leaders cannot delete their team" });
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

// POST /teams/:id/assign-leader — admin or overseer of the team's stream
router.post("/teams/:id/assign-leader", requireManager, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const teamId = params.data.id;
  const user = req.authUser!;

  // Leaders can't reassign their own team's leader; that's an admin/overseer action.
  if (user.role === "leader") {
    res.status(403).json({ error: "Team leaders cannot reassign team leaders" });
    return;
  }
  if (!(await userCanAccessTeam(user, teamId))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = AssignTeamLeaderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const leaderId = parsed.data.leaderId ?? null;

  // Validate the target user is in scope (admin always passes; overseer
  // requires the target to be a non-admin in the same stream).
  if (leaderId) {
    const [existingTeam] = await db
      .select({ streamId: teamsTable.streamId })
      .from(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .limit(1);
    const check = await userCanAssignAsLeader(user, leaderId, existingTeam?.streamId ?? null);
    if (!check.ok) { res.status(check.status).json({ error: check.error }); return; }
  }

  const [team] = await db
    .update(teamsTable)
    .set({ leaderId })
    .where(eq(teamsTable.id, teamId))
    .returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  if (leaderId) {
    await db
      .update(usersTable)
      .set({ teamId, streamId: team.streamId, role: "leader" })
      .where(eq(usersTable.id, leaderId));
  }

  res.json(team);
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
