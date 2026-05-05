import { Router } from "express";
import { z } from "zod";
import { db, projectsTable, teamsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireAdmin, requireTeamLeader } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";

const router = Router();

// GET /projects — admin sees all; team_leader and owner see only their team's
router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;

  let projects;
  if (user.role === "admin") {
    projects = await db
      .select({
        id: projectsTable.id,
        teamId: projectsTable.teamId,
        title: projectsTable.title,
        description: projectsTable.description,
        status: projectsTable.status,
        color: projectsTable.color,
        phase: projectsTable.phase,
        dueDate: projectsTable.dueDate,
        notes: projectsTable.notes,
        tags: projectsTable.tags,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
        teamName: teamsTable.name,
      })
      .from(projectsTable)
      .leftJoin(teamsTable, eq(projectsTable.teamId, teamsTable.id))
      .orderBy(projectsTable.createdAt);
  } else {
    if (!user.teamId) { res.json([]); return; }
    projects = await db
      .select({
        id: projectsTable.id,
        teamId: projectsTable.teamId,
        title: projectsTable.title,
        description: projectsTable.description,
        status: projectsTable.status,
        color: projectsTable.color,
        phase: projectsTable.phase,
        dueDate: projectsTable.dueDate,
        notes: projectsTable.notes,
        tags: projectsTable.tags,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
        teamName: teamsTable.name,
      })
      .from(projectsTable)
      .leftJoin(teamsTable, eq(projectsTable.teamId, teamsTable.id))
      .where(eq(projectsTable.teamId, user.teamId))
      .orderBy(projectsTable.createdAt);
  }

  res.json(projects);
});

// GET /projects/:id
router.get("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [project] = await db
    .select({
      id: projectsTable.id,
      teamId: projectsTable.teamId,
      title: projectsTable.title,
      description: projectsTable.description,
      status: projectsTable.status,
      color: projectsTable.color,
      phase: projectsTable.phase,
      dueDate: projectsTable.dueDate,
      notes: projectsTable.notes,
      tags: projectsTable.tags,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
      teamName: teamsTable.name,
    })
    .from(projectsTable)
    .leftJoin(teamsTable, eq(projectsTable.teamId, teamsTable.id))
    .where(eq(projectsTable.id, id))
    .limit(1);

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  if (user.role !== "admin" && user.teamId !== project.teamId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json(project);
});

const ProjectBody = z.object({
  teamId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["not_started", "in_progress", "at_risk", "completed"]).optional(),
  color: z.string().optional(),
  phase: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// POST /projects — admin or team_leader
router.post("/projects", requireTeamLeader, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const parsed = ProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Team leaders can only create projects for their own team
  if (user.role === "team_leader" && parsed.data.teamId !== user.teamId) {
    res.status(403).json({ error: "You can only create projects for your own team" });
    return;
  }

  const [project] = await db.insert(projectsTable).values({
    ...parsed.data,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
  }).returning();

  await logActivity({ user, actionType: "create", entityType: "project", entityId: project.id, entityTitle: project.title, teamId: project.teamId });
  res.status(201).json(project);
});

const UpdateProjectBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["not_started", "in_progress", "at_risk", "completed"]).optional(),
  color: z.string().optional(),
  phase: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// PATCH /projects/:id
router.patch("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Project not found" }); return; }

  if (user.role !== "admin" && user.teamId !== existing.teamId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Owners can only update phase and notes
  if (user.role === "owner") {
    const allowed = new Set(["phase", "notes"]);
    const keys = Object.keys(parsed.data);
    if (keys.some((k) => !allowed.has(k))) {
      res.status(403).json({ error: "Owners can only update phase and notes" });
      return;
    }
  }

  const [project] = await db.update(projectsTable).set({
    ...parsed.data,
    dueDate: parsed.data.dueDate !== undefined
      ? (parsed.data.dueDate ? new Date(parsed.data.dueDate) : null)
      : undefined,
  }).where(eq(projectsTable.id, id)).returning();

  await logActivity({ user, actionType: "update", entityType: "project", entityId: project.id, entityTitle: project.title, teamId: project.teamId });
  res.json(project);
});

// DELETE /projects/:id — admin or team_leader
router.delete("/projects/:id", requireTeamLeader, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Project not found" }); return; }

  if (user.role !== "admin" && user.teamId !== existing.teamId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  await logActivity({ user, actionType: "delete", entityType: "project", entityId: id, entityTitle: existing.title, teamId: existing.teamId });
  res.sendStatus(204);
});

export default router;
