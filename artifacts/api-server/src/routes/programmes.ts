import { Router } from "express";
import { z } from "zod";
import { db, programmesTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";

const router = Router();

// GET /programmes — get the single programme (or create default)
router.get("/programmes", requireAuth, async (_req, res): Promise<void> => {
  let [programme] = await db.select().from(programmesTable).limit(1);
  if (!programme) {
    [programme] = await db
      .insert(programmesTable)
      .values({ name: "Programme" })
      .returning();
  }
  res.json(programme);
});

const ProgrammeBody = z.object({
  name: z.string().min(1),
});

// PATCH /programmes/:id — programme_lead only
router.patch("/programmes/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = ProgrammeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [programme] = await db
    .update(programmesTable)
    .set({ name: parsed.data.name })
    .returning();

  if (!programme) { res.status(404).json({ error: "Programme not found" }); return; }

  await logActivity({ user: req.authUser!, actionType: "update", entityType: "programme", entityId: programme.id, entityTitle: programme.name });
  res.json(programme);
});

export default router;
