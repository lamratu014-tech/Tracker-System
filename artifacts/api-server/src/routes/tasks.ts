import { Router } from "express";
import { z } from "zod";
import { db, tasksTable, projectsTable, personnelTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireManager } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";
import { userCanAccessTeam } from "../lib/permissions";

const router = Router();

// GET /projects/:projectId/tasks
router.get("/projects/:projectId/tasks", requireAuth, async (req, res): Promise<void> => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const user = req.authUser!;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (!(await userCanAccessTeam(user, project.teamId))) { res.status(403).json({ error: "Access denied" }); return; }

  const tasks = await db
    .select({
      id: tasksTable.id,
      projectId: tasksTable.projectId,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      priority: tasksTable.priority,
      dueDate: tasksTable.dueDate,
      assignedToUserId: tasksTable.assignedToUserId,
      assignedToMemberId: tasksTable.assignedToMemberId,
      assignedUserName: usersTable.name,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
    })
    .from(tasksTable)
    .leftJoin(usersTable, eq(tasksTable.assignedToUserId, usersTable.id))
    .where(eq(tasksTable.projectId, projectId))
    .orderBy(tasksTable.createdAt);

  const personnelIds = tasks
    .filter((t) => t.assignedToMemberId)
    .map((t) => t.assignedToMemberId!);

  const personnelNames: Record<string, string> = {};
  if (personnelIds.length > 0) {
    const personnel = await db
      .select({ id: personnelTable.id, name: personnelTable.name })
      .from(personnelTable)
      .where(eq(personnelTable.teamId, project.teamId));
    personnel.forEach((p) => { personnelNames[p.id] = p.name; });
  }

  const enriched = tasks.map((t) => ({
    ...t,
    assignedMemberName: t.assignedToMemberId ? personnelNames[t.assignedToMemberId] ?? null : null,
  }));

  res.json(enriched);
});

const TaskBody = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "at_risk", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  assignedToMemberId: z.string().optional().nullable(),
});

// POST /tasks — programme_lead or team_lead
router.post("/tasks", requireManager, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const parsed = TaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, parsed.data.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  if (!(await userCanAccessTeam(user, project.teamId))) { res.status(403).json({ error: "Access denied" }); return; }

  const [task] = await db.insert(tasksTable).values({
    ...parsed.data,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
  }).returning();

  await logActivity({ user, actionType: "create", entityType: "task", entityId: task.id, entityTitle: task.title, teamId: project.teamId });
  res.status(201).json(task);
});

// PATCH /tasks/:id
router.patch("/tasks/:id", requireManager, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Task not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, existing.projectId)).limit(1);
  if (!(await userCanAccessTeam(user, project?.teamId ?? null))) { res.status(403).json({ error: "Access denied" }); return; }

  const parsed = TaskBody.partial().omit({ projectId: true }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [task] = await db.update(tasksTable).set({
    ...parsed.data,
    dueDate: parsed.data.dueDate !== undefined
      ? (parsed.data.dueDate ? new Date(parsed.data.dueDate) : null)
      : undefined,
  }).where(eq(tasksTable.id, id)).returning();

  await logActivity({ user, actionType: "update", entityType: "task", entityId: task.id, entityTitle: task.title, teamId: project?.teamId });
  res.json(task);
});

// DELETE /tasks/:id
router.delete("/tasks/:id", requireManager, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Task not found" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, existing.projectId)).limit(1);
  if (!(await userCanAccessTeam(user, project?.teamId ?? null))) { res.status(403).json({ error: "Access denied" }); return; }

  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  await logActivity({ user, actionType: "delete", entityType: "task", entityId: id, entityTitle: existing.title, teamId: project?.teamId });
  res.sendStatus(204);
});

export default router;
