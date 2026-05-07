import { Router } from "express";
import { db, projectsTable, projectTeamsTable, teamsTable, streamsTable } from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";
import {
  CreateProjectBody,
  UpdateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  DeleteProjectParams,
} from "@workspace/api-zod";
import { requireAuth, requireManager } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";
import { userCanAccessTeam, userCanReadProject, getProjectSharedTeamIds } from "../lib/permissions";

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

type RawProject = typeof projectsTable.$inferSelect & { teamName?: string | null };

async function attachSharedTeamIds<T extends { id: string }>(
  rows: T[],
): Promise<(T & { sharedTeamIds: string[] })[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const links = await db
    .select({ projectId: projectTeamsTable.projectId, teamId: projectTeamsTable.teamId })
    .from(projectTeamsTable)
    .where(inArray(projectTeamsTable.projectId, ids));
  const map = new Map<string, string[]>();
  for (const l of links) {
    const arr = map.get(l.projectId) ?? [];
    arr.push(l.teamId);
    map.set(l.projectId, arr);
  }
  return rows.map((r) => ({ ...r, sharedTeamIds: map.get(r.id) ?? [] }));
}

/**
 * Validate sharedTeamIds: each must exist, must not equal owner, and must be
 * in the same stream as the owner team. Returns null on success, otherwise an
 * error message.
 */
async function validateSharedTeamIds(
  ownerTeamId: string,
  sharedTeamIds: string[],
): Promise<string | null> {
  if (sharedTeamIds.length === 0) return null;
  const unique = Array.from(new Set(sharedTeamIds));
  if (unique.includes(ownerTeamId)) return "Owner team cannot be in sharedTeamIds";
  const [owner] = await db
    .select({ streamId: teamsTable.streamId })
    .from(teamsTable)
    .where(eq(teamsTable.id, ownerTeamId))
    .limit(1);
  if (!owner) return "Owner team not found";
  if (!owner.streamId) return "Owner team has no stream; cannot share";
  const found = await db
    .select({ id: teamsTable.id, streamId: teamsTable.streamId })
    .from(teamsTable)
    .where(inArray(teamsTable.id, unique));
  if (found.length !== unique.length) return "One or more shared teams not found";
  for (const t of found) {
    if (t.streamId !== owner.streamId) {
      return "Shared teams must belong to the same stream as the owner team";
    }
  }
  return null;
}

router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;

  let rows: RawProject[];
  if (user.role === "admin") {
    rows = await db
      .select(projectColumns)
      .from(projectsTable)
      .leftJoin(teamsTable, eq(projectsTable.teamId, teamsTable.id))
      .orderBy(projectsTable.createdAt);
  } else {
    let visibleTeamIds: string[] = [];
    if (user.role === "programme_overseer" && user.programmeId) {
      visibleTeamIds = (
        await db
          .select({ id: teamsTable.id })
          .from(teamsTable)
          .innerJoin(streamsTable, eq(teamsTable.streamId, streamsTable.id))
          .where(eq(streamsTable.programmeId, user.programmeId))
      ).map((t) => t.id);
    } else if (user.role === "stream_overseer" && user.streamId) {
      visibleTeamIds = (
        await db
          .select({ id: teamsTable.id })
          .from(teamsTable)
          .where(eq(teamsTable.streamId, user.streamId))
      ).map((t) => t.id);
    } else if (user.teamId) {
      visibleTeamIds = [user.teamId];
    }

    if (visibleTeamIds.length === 0) {
      res.json([]);
      return;
    }

    // Owner OR shared visibility, distinct.
    const sharedProjectIds = (
      await db
        .selectDistinct({ id: projectTeamsTable.projectId })
        .from(projectTeamsTable)
        .where(inArray(projectTeamsTable.teamId, visibleTeamIds))
    ).map((r) => r.id);

    rows = await db
      .select(projectColumns)
      .from(projectsTable)
      .leftJoin(teamsTable, eq(projectsTable.teamId, teamsTable.id))
      .where(
        sharedProjectIds.length > 0
          ? or(
              inArray(projectsTable.teamId, visibleTeamIds),
              inArray(projectsTable.id, sharedProjectIds),
            )
          : inArray(projectsTable.teamId, visibleTeamIds),
      )
      .orderBy(projectsTable.createdAt);
  }

  const enriched = await attachSharedTeamIds(rows);
  res.json(enriched);
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

  const sharedTeamIds = await getProjectSharedTeamIds(project.id);

  if (!(await userCanReadProject(user, project.teamId, sharedTeamIds))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json({ ...project, sharedTeamIds });
});

router.post("/projects", requireManager, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (!(await userCanAccessTeam(user, parsed.data.teamId))) {
    res.status(403).json({ error: "You can only create projects for teams you manage" });
    return;
  }

  const sharedTeamIds = Array.from(new Set(parsed.data.sharedTeamIds ?? []));
  const validationError = await validateSharedTeamIds(parsed.data.teamId, sharedTeamIds);
  if (validationError) { res.status(400).json({ error: validationError }); return; }

  const project = await db.transaction(async (tx) => {
    const [created] = await tx.insert(projectsTable).values({
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
    if (sharedTeamIds.length > 0) {
      await tx.insert(projectTeamsTable).values(
        sharedTeamIds.map((teamId) => ({ projectId: created.id, teamId })),
      );
    }
    return created;
  });

  await logActivity({ user, actionType: "create", entityType: "project", entityId: project.id, entityTitle: project.title, teamId: project.teamId });
  res.status(201).json({ ...project, sharedTeamIds });
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

  let nextSharedTeamIds: string[] | null = null;
  if ("sharedTeamIds" in parsed.data && parsed.data.sharedTeamIds !== undefined) {
    nextSharedTeamIds = Array.from(new Set(parsed.data.sharedTeamIds));
    const validationError = await validateSharedTeamIds(existing.teamId, nextSharedTeamIds);
    if (validationError) { res.status(400).json({ error: validationError }); return; }
  }

  const project = await db.transaction(async (tx) => {
    const [updated] = Object.keys(patch).length > 0
      ? await tx.update(projectsTable).set(patch).where(eq(projectsTable.id, params.data.id)).returning()
      : [existing];
    if (nextSharedTeamIds !== null) {
      await tx.delete(projectTeamsTable).where(eq(projectTeamsTable.projectId, params.data.id));
      if (nextSharedTeamIds.length > 0) {
        await tx.insert(projectTeamsTable).values(
          nextSharedTeamIds.map((teamId) => ({ projectId: params.data.id, teamId })),
        );
      }
    }
    return updated;
  });

  const sharedTeamIds = await getProjectSharedTeamIds(project.id);
  await logActivity({ user, actionType: "update", entityType: "project", entityId: project.id, entityTitle: project.title, teamId: project.teamId });
  res.json({ ...project, sharedTeamIds });
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
