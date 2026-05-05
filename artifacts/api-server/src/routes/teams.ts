import { Router } from "express";
import { z } from "zod";
import { db, teamsTable, personnelTable, usersTable, streamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireProgrammeLead, requireTeamLead } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";

const router = Router();

// GET /teams — all authenticated users see all teams (name/id/stream)
router.get("/teams", requireAuth, async (_req, res): Promise<void> => {
  const teams = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      streamId: teamsTable.streamId,
      functionLabel: teamsTable.functionLabel,
      createdAt: teamsTable.createdAt,
      streamName: streamsTable.name,
    })
    .from(teamsTable)
    .leftJoin(streamsTable, eq(teamsTable.streamId, streamsTable.id))
    .orderBy(teamsTable.name);
  res.json(teams);
});

// GET /teams/:id
router.get("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [team] = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      streamId: teamsTable.streamId,
      functionLabel: teamsTable.functionLabel,
      createdAt: teamsTable.createdAt,
      streamName: streamsTable.name,
    })
    .from(teamsTable)
    .leftJoin(streamsTable, eq(teamsTable.streamId, streamsTable.id))
    .where(eq(teamsTable.id, id))
    .limit(1);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  res.json(team);
});

const TeamBody = z.object({
  name: z.string().min(1),
  streamId: z.string().optional().nullable(),
  functionLabel: z.string().optional(),
});

// POST /teams — programme_lead only
router.post("/teams", requireProgrammeLead, async (req, res): Promise<void> => {
  const parsed = TeamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [team] = await db.insert(teamsTable).values(parsed.data).returning();
  await logActivity({ user: req.authUser!, actionType: "create", entityType: "team", entityId: team.id, entityTitle: team.name });
  res.status(201).json(team);
});

// PATCH /teams/:id — programme_lead only
router.patch("/teams/:id", requireProgrammeLead, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = TeamBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [team] = await db.update(teamsTable).set(parsed.data).where(eq(teamsTable.id, id)).returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  await logActivity({ user: req.authUser!, actionType: "update", entityType: "team", entityId: team.id, entityTitle: team.name });
  res.json(team);
});

// DELETE /teams/:id — programme_lead only
router.delete("/teams/:id", requireProgrammeLead, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [team] = await db.delete(teamsTable).where(eq(teamsTable.id, id)).returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  await logActivity({ user: req.authUser!, actionType: "delete", entityType: "team", entityId: id, entityTitle: team.name });
  res.sendStatus(204);
});

// POST /teams/:id/assign-lead — programme_lead assigns a team_lead to a team
router.post("/teams/:id/assign-lead", requireProgrammeLead, async (req, res): Promise<void> => {
  const teamId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { userId } = z.object({ userId: z.string() }).parse(req.body);

  const [user] = await db
    .update(usersTable)
    .set({ teamId, role: "team_lead" })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

// ─── Personnel ────────────────────────────────────────────────────────────────

// GET /teams/:id/personnel — programme_lead or team_lead of that team
router.get("/teams/:id/personnel", requireAuth, async (req, res): Promise<void> => {
  const teamId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  if (user.role !== "programme_lead" && user.teamId !== teamId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const personnel = await db
    .select()
    .from(personnelTable)
    .where(eq(personnelTable.teamId, teamId))
    .orderBy(personnelTable.name);
  res.json(personnel);
});

const PersonnelBody = z.object({
  name: z.string().min(1),
  roleLabel: z.string().optional(),
});

// POST /teams/:id/personnel — programme_lead or team_lead of that team
router.post("/teams/:id/personnel", requireTeamLead, async (req, res): Promise<void> => {
  const teamId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  if (user.role !== "programme_lead" && user.teamId !== teamId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = PersonnelBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [member] = await db.insert(personnelTable).values({ ...parsed.data, teamId }).returning();
  await logActivity({ user, actionType: "create", entityType: "personnel", entityId: member.id, entityTitle: member.name, teamId });
  res.status(201).json(member);
});

// PATCH /personnel/:id — programme_lead or team_lead of that team
router.patch("/personnel/:id", requireTeamLead, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(personnelTable).where(eq(personnelTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (user.role !== "programme_lead" && user.teamId !== existing.teamId) { res.status(403).json({ error: "Access denied" }); return; }

  const parsed = PersonnelBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [member] = await db.update(personnelTable).set(parsed.data).where(eq(personnelTable.id, id)).returning();
  res.json(member);
});

// DELETE /personnel/:id — programme_lead or team_lead of that team
router.delete("/personnel/:id", requireTeamLead, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(personnelTable).where(eq(personnelTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (user.role !== "programme_lead" && user.teamId !== existing.teamId) { res.status(403).json({ error: "Access denied" }); return; }

  await db.delete(personnelTable).where(eq(personnelTable.id, id));
  await logActivity({ user, actionType: "delete", entityType: "personnel", entityId: id, entityTitle: existing.name });
  res.sendStatus(204);
});

export default router;
