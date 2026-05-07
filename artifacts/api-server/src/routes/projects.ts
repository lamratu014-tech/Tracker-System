import { Router } from "express";
import { db, projectsTable, teamsTable, streamsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import {
  CreateProjectBody,
  UpdateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  DeleteProjectParams,
} from "@workspace/api-zod";
import { requireAuth, requireManager } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";
import { userCanAccessTeam } from "../lib/permissions";

const router = Router();

const projectColumns = {
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
};

router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;

  const baseQuery = db
    .select(projectColumns)
    .from(projectsTable)
    .leftJoin(teamsTable, eq(projectsTable.teamId, teamsTable.id));

  if (user.role === "admin") {
    res.json(await baseQuery.orderBy(projectsTable.createdAt));
    return;
  }

  if (user.role === "programme_overseer" && user.programmeId) {
    const teamIds = (
      await db
        .select({ id: teamsTable.id })
        .from(teamsTable)
        .innerJoin(streamsTable, eq(teamsTable.streamId, streamsTable.id))
        .where(eq(streamsTable.programmeId, user.programmeId))
    ).map((t) => t.id);
    if (!teamIds.length) { res.json([]); return; }
    res.json(
      await db
        .select(projectColumns)
        .from(projectsTable)
        .leftJoin(teamsTable, eq(projectsTable.teamId, teamsTable.id))
        .where(inArray(projectsTable.teamId, teamIds))
        .orderBy(projectsTable.createdAt)
    );
    return;
  }

  if (user.role === "stream_overseer" && user.streamId) {
    const teamIds = (
      await db
        .select({ id: teamsTable.id })
        .from(teamsTable)
        .where(eq(teamsTable.streamId, user.streamId))
    ).map((t) => t.id);
    if (!teamIds.length) { res.json([]); return; }
    res.json(
      await db
        .select(projectColumns)
        .from(projectsTable)
        .leftJoin(teamsTable, eq(projectsTable.teamId, teamsTable.id))
        .where(inArray(projectsTable.teamId, teamIds))
        .orderBy(projectsTable.createdAt)
    );
    return;
  }

  if (!user.teamId) { res.json([]); return; }
  res.json(
    await db
      .select(projectColumns)
      .from(projectsTable)
      .leftJoin(teamsTable, eq(projectsTable.teamId, teamsTable.id))
      .where(eq(projectsTable.teamId, user.teamId))
      .orderBy(projectsTable.createdAt)
  );
});

router.get("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;

  const [project] = await db
    .select(projectColumns)
    .from(projectsTable)
    .leftJoin(teamsTable, eq(projectsTable.teamId, teamsTable.id))
    .where(eq(projectsTable.id, params.data.id))
    .limit(1);

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  if (!(await userCanAccessTeam(user, project.teamId))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json(project);
});

router.post("/projects", requireManager, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (!(await userCanAccessTeam(user, parsed.data.teamId))) {
    res.status(403).json({ error: "You can only create projects for teams you manage" });
    return;
  }

  const [project] = await db.insert(projectsTable).values({
    teamId: parsed.data.teamId,
    title: parsed.data.title,
    description: parsed.data.description,
    status: parsed.data.status,
    color: parsed.data.color,
    phase: parsed.data.phase,
    notes: parsed.data.notes,
    tags: parsed.data.tags,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
  }).returning();

  await logActivity({ user, actionType: "create", entityType: "project", entityId: project.id, entityTitle: project.title, teamId: project.teamId });
  res.status(201).json(project);
});

router.patch("/projects/:id", requireManager, async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;

  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Project not found" }); return; }

  if (!(await userCanAccessTeam(user, existing.teamId))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const patch: Partial<typeof projectsTable.$inferInsert> = {};
  if ("title" in parsed.data) patch.title = parsed.data.title;
  if ("description" in parsed.data) patch.description = parsed.data.description;
  if ("status" in parsed.data) patch.status = parsed.data.status;
  if ("color" in parsed.data) patch.color = parsed.data.color;
  if ("phase" in parsed.data) patch.phase = parsed.data.phase;
  if ("notes" in parsed.data) patch.notes = parsed.data.notes;
  if ("tags" in parsed.data) patch.tags = parsed.data.tags;
  if ("dueDate" in parsed.data) patch.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;

  const [project] = await db.update(projectsTable).set(patch).where(eq(projectsTable.id, params.data.id)).returning();

  await logActivity({ user, actionType: "update", entityType: "project", entityId: project.id, entityTitle: project.title, teamId: project.teamId });
  res.json(project);
});

router.delete("/projects/:id", requireManager, async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;

  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Project not found" }); return; }

  if (!(await userCanAccessTeam(user, existing.teamId))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id));
  await logActivity({ user, actionType: "delete", entityType: "project", entityId: params.data.id, entityTitle: existing.title, teamId: existing.teamId });
  res.sendStatus(204);
});

export default router;
