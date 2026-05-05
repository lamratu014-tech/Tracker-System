import { Router } from "express";
import { db, milestonesTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateMilestoneBody,
  UpdateMilestoneBody,
  SetMilestoneStatusBody,
  ListProjectMilestonesParams,
  UpdateMilestoneParams,
  DeleteMilestoneParams,
  SetMilestoneStatusParams,
} from "@workspace/api-zod";
import { requireAuth, requireManager } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";
import { userCanAccessTeam } from "../lib/permissions";

const router = Router();

router.get("/projects/:projectId/milestones", requireAuth, async (req, res): Promise<void> => {
  const params = ListProjectMilestonesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (!(await userCanAccessTeam(user, project.teamId))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const milestones = await db
    .select()
    .from(milestonesTable)
    .where(eq(milestonesTable.projectId, params.data.projectId))
    .orderBy(milestonesTable.date);
  res.json(milestones);
});

router.post("/milestones", requireManager, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const parsed = CreateMilestoneBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parsed.data.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (!(await userCanAccessTeam(user, project.teamId))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const [milestone] = await db.insert(milestonesTable).values({
    projectId: parsed.data.projectId,
    title: parsed.data.title,
    date: new Date(parsed.data.date),
    completed: parsed.data.completed,
  }).returning();

  await logActivity({ user, actionType: "create", entityType: "milestone", entityId: milestone.id, entityTitle: milestone.title, teamId: project.teamId });
  res.status(201).json(milestone);
});

router.patch("/milestones/:id", requireManager, async (req, res): Promise<void> => {
  const params = UpdateMilestoneParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;

  const [existing] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Milestone not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, existing.projectId)).limit(1);
  if (!(await userCanAccessTeam(user, project?.teamId ?? null))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = UpdateMilestoneBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const patch: Partial<typeof milestonesTable.$inferInsert> = {};
  if ("title" in parsed.data) patch.title = parsed.data.title;
  if ("completed" in parsed.data) patch.completed = parsed.data.completed;
  if ("date" in parsed.data && parsed.data.date) patch.date = new Date(parsed.data.date);

  const [milestone] = await db.update(milestonesTable).set(patch).where(eq(milestonesTable.id, params.data.id)).returning();

  await logActivity({ user, actionType: "update", entityType: "milestone", entityId: milestone.id, entityTitle: milestone.title, teamId: project?.teamId });
  res.json(milestone);
});

router.patch("/milestones/:id/status", requireManager, async (req, res): Promise<void> => {
  const params = SetMilestoneStatusParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;

  const [existing] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Milestone not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, existing.projectId)).limit(1);
  if (!(await userCanAccessTeam(user, project?.teamId ?? null))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = SetMilestoneStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [milestone] = await db
    .update(milestonesTable)
    .set({ completed: parsed.data.completed })
    .where(eq(milestonesTable.id, params.data.id))
    .returning();

  await logActivity({ user, actionType: "update", entityType: "milestone", entityId: milestone.id, entityTitle: milestone.title, teamId: project?.teamId });
  res.json(milestone);
});

router.delete("/milestones/:id", requireManager, async (req, res): Promise<void> => {
  const params = DeleteMilestoneParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;

  const [existing] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Milestone not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, existing.projectId)).limit(1);
  if (!(await userCanAccessTeam(user, project?.teamId ?? null))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await db.delete(milestonesTable).where(eq(milestonesTable.id, params.data.id));
  await logActivity({ user, actionType: "delete", entityType: "milestone", entityId: params.data.id, entityTitle: existing.title, teamId: project?.teamId });
  res.sendStatus(204);
});

export default router;
