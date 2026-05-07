import { Router } from "express";
import { db, streamsTable, teamsTable, programmesTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  CreateStreamBody,
  UpdateStreamBody,
  GetStreamParams,
  UpdateStreamParams,
  DeleteStreamParams,
  ListStreamTeamsParams,
} from "@workspace/api-zod";
import { requireAuth, requireManager } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";
import { userCanAccessStream, userCanManageProgramme, userCanReadStream, visibleTeamIdsFor } from "../lib/permissions";

const router = Router();

router.get("/streams", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;

  if (user.role === "admin") {
    const streams = await db.select().from(streamsTable).orderBy(streamsTable.name);
    res.json(streams);
    return;
  }

  if (user.role === "programme_overseer") {
    if (!user.programmeId) { res.json([]); return; }
    const streams = await db
      .select()
      .from(streamsTable)
      .where(eq(streamsTable.programmeId, user.programmeId))
      .orderBy(streamsTable.name);
    res.json(streams);
    return;
  }

  if (user.role === "stream_overseer") {
    if (!user.streamId) { res.json([]); return; }
    const streams = await db.select().from(streamsTable).where(eq(streamsTable.id, user.streamId)).orderBy(streamsTable.name);
    res.json(streams);
    return;
  }

  if (user.role === "leader") {
    if (!user.teamId) { res.json([]); return; }
    const [team] = await db.select({ streamId: teamsTable.streamId }).from(teamsTable).where(eq(teamsTable.id, user.teamId)).limit(1);
    if (!team?.streamId) { res.json([]); return; }
    const streams = await db.select().from(streamsTable).where(eq(streamsTable.id, team.streamId));
    res.json(streams);
    return;
  }

  res.json([]);
});

router.get("/streams/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetStreamParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;
  if (!(await userCanReadStream(user, params.data.id))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const [stream] = await db.select().from(streamsTable).where(eq(streamsTable.id, params.data.id)).limit(1);
  if (!stream) { res.status(404).json({ error: "Stream not found" }); return; }
  res.json(stream);
});

// POST /streams — admin or programme_overseer of the target programme
router.post("/streams", requireManager, async (req, res): Promise<void> => {
  const parsed = CreateStreamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [programme] = await db.select().from(programmesTable).where(eq(programmesTable.id, parsed.data.programmeId)).limit(1);
  if (!programme) { res.status(404).json({ error: "Programme not found" }); return; }

  if (!(await userCanManageProgramme(req.authUser!, parsed.data.programmeId))) {
    res.status(403).json({ error: "You can only create streams in your own programme" });
    return;
  }

  const [stream] = await db
    .insert(streamsTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      programmeId: parsed.data.programmeId,
    })
    .returning();
  await logActivity({ user: req.authUser!, actionType: "create", entityType: "stream", entityId: stream.id, entityTitle: stream.name });
  res.status(201).json(stream);
});

// PATCH /streams/:id — admin or overseer of this stream
router.patch("/streams/:id", requireManager, async (req, res): Promise<void> => {
  const params = UpdateStreamParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateStreamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (!(await userCanAccessStream(req.authUser!, params.data.id))) {
    res.status(403).json({ error: "You can only edit your own stream" });
    return;
  }

  const patch: Partial<typeof streamsTable.$inferInsert> = {};
  if ("name" in parsed.data) patch.name = parsed.data.name;
  if ("description" in parsed.data) patch.description = parsed.data.description;

  const [stream] = await db.update(streamsTable).set(patch).where(eq(streamsTable.id, params.data.id)).returning();
  if (!stream) { res.status(404).json({ error: "Stream not found" }); return; }

  await logActivity({ user: req.authUser!, actionType: "update", entityType: "stream", entityId: stream.id, entityTitle: stream.name });
  res.json(stream);
});

// DELETE /streams/:id — admin or overseer of this stream
router.delete("/streams/:id", requireManager, async (req, res): Promise<void> => {
  const params = DeleteStreamParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  if (!(await userCanAccessStream(req.authUser!, params.data.id))) {
    res.status(403).json({ error: "You can only delete your own stream" });
    return;
  }

  const [stream] = await db.delete(streamsTable).where(eq(streamsTable.id, params.data.id)).returning();
  if (!stream) { res.status(404).json({ error: "Stream not found" }); return; }

  await logActivity({ user: req.authUser!, actionType: "delete", entityType: "stream", entityId: params.data.id, entityTitle: stream.name });
  res.sendStatus(204);
});

router.get("/streams/:id/teams", requireAuth, async (req, res): Promise<void> => {
  const params = ListStreamTeamsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;

  if (!(await userCanReadStream(user, params.data.id))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const visibleIds = await visibleTeamIdsFor(user);
  let teams: (typeof teamsTable.$inferSelect)[] = [];
  if (visibleIds === "all") {
    teams = await db
      .select()
      .from(teamsTable)
      .where(eq(teamsTable.streamId, params.data.id))
      .orderBy(teamsTable.name);
  } else if (visibleIds.length > 0) {
    teams = await db
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.streamId, params.data.id), inArray(teamsTable.id, visibleIds)))
      .orderBy(teamsTable.name);
  } else {
    teams = [];
  }
  res.json(teams);
});

export default router;
