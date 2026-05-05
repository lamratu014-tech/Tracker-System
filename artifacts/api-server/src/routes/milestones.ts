import { Router } from "express";
import { z } from "zod";
import { db, milestonesTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireTeamLead } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";

const router = Router();

// GET /projects/:projectId/milestones
router.get("/projects/:projectId/milestones", requireAuth, async (req, res): Promise<void> => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const user = req.authUser!;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (user.role !== "programme_lead" && user.teamId !== project.teamId) { res.status(403).json({ error: "Access denied" }); return; }

  const milestones = await db
    .select()
    .from(milestonesTable)
    .where(eq(milestonesTable.projectId, projectId))
    .orderBy(milestonesTable.date);

  res.json(milestones);
});

const MilestoneBody = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  date: z.string().datetime(),
  completed: z.boolean().optional(),
});

// POST /milestones — team_lead or programme_lead
router.post("/milestones", requireTeamLead, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const parsed = MilestoneBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parsed.data.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (user.role !== "programme_lead" && user.teamId !== project.teamId) { res.status(403).json({ error: "Access denied" }); return; }

  const [milestone] = await db.insert(milestonesTable).values({
    ...parsed.data,
    date: new Date(parsed.data.date),
  }).returning();

  await logActivity({ user, actionType: "create", entityType: "milestone", entityId: milestone.id, entityTitle: milestone.title, teamId: project.teamId });
  res.status(201).json(milestone);
});

// PATCH /milestones/:id — team_lead (own) or programme_lead
router.patch("/milestones/:id", requireTeamLead, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Milestone not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, existing.projectId)).limit(1);
  if (user.role !== "programme_lead" && user.teamId !== project?.teamId) { res.status(403).json({ error: "Access denied" }); return; }

  const parsed = MilestoneBody.partial().omit({ projectId: true }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [milestone] = await db.update(milestonesTable).set({
    ...parsed.data,
    date: parsed.data.date ? new Date(parsed.data.date) : undefined,
  }).where(eq(milestonesTable.id, id)).returning();

  await logActivity({ user, actionType: "update", entityType: "milestone", entityId: milestone.id, entityTitle: milestone.title, teamId: project?.teamId });
  res.json(milestone);
});

// DELETE /milestones/:id
router.delete("/milestones/:id", requireTeamLead, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Milestone not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, existing.projectId)).limit(1);
  if (user.role !== "programme_lead" && user.teamId !== project?.teamId) { res.status(403).json({ error: "Access denied" }); return; }

  await db.delete(milestonesTable).where(eq(milestonesTable.id, id));
  await logActivity({ user, actionType: "delete", entityType: "milestone", entityId: id, entityTitle: existing.title, teamId: project?.teamId });
  res.sendStatus(204);
});

export default router;
