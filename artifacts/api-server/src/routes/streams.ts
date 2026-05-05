import { Router } from "express";
import { z } from "zod";
import { db, streamsTable, teamsTable, programmesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireProgrammeLead } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";

const router = Router();

// GET /streams — all authenticated users can see streams
router.get("/streams", requireAuth, async (_req, res): Promise<void> => {
  const streams = await db
    .select()
    .from(streamsTable)
    .orderBy(streamsTable.name);
  res.json(streams);
});

// GET /streams/:id — all authenticated users
router.get("/streams/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [stream] = await db.select().from(streamsTable).where(eq(streamsTable.id, id)).limit(1);
  if (!stream) { res.status(404).json({ error: "Stream not found" }); return; }
  res.json(stream);
});

const StreamBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  programmeId: z.string().min(1),
});

// POST /streams — programme_lead only
router.post("/streams", requireProgrammeLead, async (req, res): Promise<void> => {
  const parsed = StreamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [programme] = await db.select().from(programmesTable).where(eq(programmesTable.id, parsed.data.programmeId)).limit(1);
  if (!programme) { res.status(404).json({ error: "Programme not found" }); return; }

  const [stream] = await db.insert(streamsTable).values(parsed.data).returning();
  await logActivity({ user: req.authUser!, actionType: "create", entityType: "stream", entityId: stream.id, entityTitle: stream.name });
  res.status(201).json(stream);
});

// PATCH /streams/:id — programme_lead only
router.patch("/streams/:id", requireProgrammeLead, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = StreamBody.partial().omit({ programmeId: true }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [stream] = await db.update(streamsTable).set(parsed.data).where(eq(streamsTable.id, id)).returning();
  if (!stream) { res.status(404).json({ error: "Stream not found" }); return; }

  await logActivity({ user: req.authUser!, actionType: "update", entityType: "stream", entityId: stream.id, entityTitle: stream.name });
  res.json(stream);
});

// DELETE /streams/:id — programme_lead only
router.delete("/streams/:id", requireProgrammeLead, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [stream] = await db.delete(streamsTable).where(eq(streamsTable.id, id)).returning();
  if (!stream) { res.status(404).json({ error: "Stream not found" }); return; }

  await logActivity({ user: req.authUser!, actionType: "delete", entityType: "stream", entityId: id, entityTitle: stream.name });
  res.sendStatus(204);
});

// GET /streams/:id/teams — all teams in a stream
router.get("/streams/:id/teams", requireAuth, async (req, res): Promise<void> => {
  const streamId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.streamId, streamId))
    .orderBy(teamsTable.name);
  res.json(teams);
});

export default router;
