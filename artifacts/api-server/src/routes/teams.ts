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
import { requireAuth, requireAdmin, requireManager } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";
import { userCanAccessTeam } from "../lib/permissions";

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

// POST /teams — admin only
router.post("/teams", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateTeamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, streamId, leaderId, functionLabel } = parsed.data;

  const [team] = await db
    .insert(teamsTable)
    .values({ name, streamId: streamId ?? null, leaderId: leaderId ?? null, functionLabel })
    .returning();
  await logActivity({ user: req.authUser!, actionType: "create", entityType: "team", entityId: team.id, entityTitle: team.name });
  res.status(201).json(team);
});

// PATCH /teams/:id — admin only
router.patch("/teams/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateTeamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Preserve the difference between "key omitted" (don't touch) and "key=null" (clear).
  const patch: Partial<typeof teamsTable.$inferInsert> = {};
  if ("name" in parsed.data) patch.name = parsed.data.name;
  if ("streamId" in parsed.data) patch.streamId = parsed.data.streamId ?? null;
  if ("leaderId" in parsed.data) patch.leaderId = parsed.data.leaderId ?? null;
  if ("functionLabel" in parsed.data) patch.functionLabel = parsed.data.functionLabel;

  const [team] = await db.update(teamsTable).set(patch).where(eq(teamsTable.id, params.data.id)).returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  await logActivity({ user: req.authUser!, actionType: "update", entityType: "team", entityId: team.id, entityTitle: team.name });
  res.json(team);
});

// DELETE /teams/:id — admin only
router.delete("/teams/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [team] = await db.delete(teamsTable).where(eq(teamsTable.id, params.data.id)).returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  await logActivity({ user: req.authUser!, actionType: "delete", entityType: "team", entityId: params.data.id, entityTitle: team.name });
  res.sendStatus(204);
});

// POST /teams/:id/assign-leader — admin assigns/clears the team leader
router.post("/teams/:id/assign-leader", requireAdmin, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const teamId = params.data.id;

  const parsed = AssignTeamLeaderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const leaderId = parsed.data.leaderId ?? null;

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
