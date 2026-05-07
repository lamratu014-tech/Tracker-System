import { Router } from "express";
import { db, programmesTable, streamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateProgrammeBody,
  UpdateProgrammeBody,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";

const router = Router();

// GET /programmes — list all programmes (seed default if none exist)
router.get("/programmes", requireAuth, async (_req, res): Promise<void> => {
  let programmes = await db
    .select()
    .from(programmesTable)
    .orderBy(programmesTable.createdAt);
  if (programmes.length === 0) {
    const [seeded] = await db
      .insert(programmesTable)
      .values({ name: "Programme" })
      .returning();
    programmes = [seeded];
  }
  res.json(programmes);
});

// POST /programmes — admin only
router.post("/programmes", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateProgrammeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [programme] = await db
    .insert(programmesTable)
    .values({ name: parsed.data.name })
    .returning();
  await logActivity({
    user: req.authUser!,
    actionType: "create",
    entityType: "programme",
    entityId: programme.id,
    entityTitle: programme.name,
  });
  res.status(201).json(programme);
});

// PATCH /programmes/:id — admin only (rename)
router.patch("/programmes/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateProgrammeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [programme] = await db
    .update(programmesTable)
    .set({ name: parsed.data.name })
    .where(eq(programmesTable.id, id))
    .returning();

  if (!programme) {
    res.status(404).json({ error: "Programme not found" });
    return;
  }

  await logActivity({
    user: req.authUser!,
    actionType: "update",
    entityType: "programme",
    entityId: programme.id,
    entityTitle: programme.name,
  });
  res.json(programme);
});

// DELETE /programmes/:id — admin only; 409 if any streams reference it
router.delete("/programmes/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [existing] = await db
    .select()
    .from(programmesTable)
    .where(eq(programmesTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Programme not found" });
    return;
  }

  const referencingStreams = await db
    .select({ id: streamsTable.id })
    .from(streamsTable)
    .where(eq(streamsTable.programmeId, id))
    .limit(1);
  if (referencingStreams.length > 0) {
    res.status(409).json({
      error: "Programme still has streams. Remove the streams first.",
    });
    return;
  }

  await db.delete(programmesTable).where(eq(programmesTable.id, id));
  await logActivity({
    user: req.authUser!,
    actionType: "delete",
    entityType: "programme",
    entityId: id,
    entityTitle: existing.name,
  });
  res.sendStatus(204);
});

export default router;
