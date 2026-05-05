import { Router } from "express";
import { z } from "zod";
import { db, teamsTable, personnelTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin, requireTeamLeader } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";

const router = Router();

// GET /teams — all authenticated users get public metadata; team_leaders/owners get only names+ids
router.get("/teams", requireAuth, async (req, res): Promise<void> => {
  const teams = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      functionLabel: teamsTable.functionLabel,
      createdAt: teamsTable.createdAt,
    })
    .from(teamsTable)
    .orderBy(teamsTable.name);
  res.json(teams);
});

// GET /teams/:id — admin only for full detail; others get public metadata
router.get("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, id)).limit(1);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  // Non-admins outside this team only see public metadata
  if (user.role !== "admin" && user.teamId !== id) {
    res.json({ id: team.id, name: team.name, functionLabel: team.functionLabel });
    return;
  }

  res.json(team);
});

const TeamBody = z.object({
  name: z.string().min(1),
  functionLabel: z.string().optional(),
});

// POST /teams — admin only
router.post("/teams", requireAdmin, async (req, res): Promise<void> => {
  const parsed = TeamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [team] = await db.insert(teamsTable).values(parsed.data).returning();
  await logActivity({ user: req.authUser!, actionType: "create", entityType: "team", entityId: team.id, entityTitle: team.name });
  res.status(201).json(team);
});

// PATCH /teams/:id — admin only
router.patch("/teams/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = TeamBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [team] = await db.update(teamsTable).set(parsed.data).where(eq(teamsTable.id, id)).returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  await logActivity({ user: req.authUser!, actionType: "update", entityType: "team", entityId: team.id, entityTitle: team.name });
  res.json(team);
});

// DELETE /teams/:id — admin only
router.delete("/teams/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [team] = await db.delete(teamsTable).where(eq(teamsTable.id, id)).returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  await logActivity({ user: req.authUser!, actionType: "delete", entityType: "team", entityId: id, entityTitle: team.name });
  res.sendStatus(204);
});

// POST /teams/:id/assign-leader — admin assigns a team_leader to a team
router.post("/teams/:id/assign-leader", requireAdmin, async (req, res): Promise<void> => {
  const teamId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { userId } = z.object({ userId: z.string() }).parse(req.body);

  const [user] = await db
    .update(usersTable)
    .set({ teamId, role: "team_leader" })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  res.json(user);
});

// POST /teams/:id/assign-owner — admin assigns an owner to a team
router.post("/teams/:id/assign-owner", requireAdmin, async (req, res): Promise<void> => {
  const teamId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { userId } = z.object({ userId: z.string() }).parse(req.body);

  const [user] = await db
    .update(usersTable)
    .set({ teamId, role: "owner" })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  res.json(user);
});

// ─── Personnel ────────────────────────────────────────────────────────────────

// GET /teams/:id/personnel — admin or members of that team
router.get("/teams/:id/personnel", requireAuth, async (req, res): Promise<void> => {
  const teamId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  if (user.role !== "admin" && user.teamId !== teamId) {
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

// POST /teams/:id/personnel — admin or team_leader of that team
router.post("/teams/:id/personnel", requireTeamLeader, async (req, res): Promise<void> => {
  const teamId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  if (user.role !== "admin" && user.teamId !== teamId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = PersonnelBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [member] = await db.insert(personnelTable).values({ ...parsed.data, teamId }).returning();
  await logActivity({ user, actionType: "create", entityType: "personnel", entityId: member.id, entityTitle: member.name, teamId });
  res.status(201).json(member);
});

// PATCH /personnel/:id — admin or team_leader of that team
router.patch("/personnel/:id", requireTeamLeader, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(personnelTable).where(eq(personnelTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (user.role !== "admin" && user.teamId !== existing.teamId) { res.status(403).json({ error: "Access denied" }); return; }

  const parsed = PersonnelBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [member] = await db.update(personnelTable).set(parsed.data).where(eq(personnelTable.id, id)).returning();
  res.json(member);
});

// DELETE /personnel/:id — admin or team_leader of that team
router.delete("/personnel/:id", requireTeamLeader, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(personnelTable).where(eq(personnelTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (user.role !== "admin" && user.teamId !== existing.teamId) { res.status(403).json({ error: "Access denied" }); return; }

  await db.delete(personnelTable).where(eq(personnelTable.id, id));
  await logActivity({ user, actionType: "delete", entityType: "personnel", entityId: id, entityTitle: existing.name });
  res.sendStatus(204);
});

export default router;
