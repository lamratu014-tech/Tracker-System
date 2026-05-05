import { Router } from "express";
import { db, teamNotesTable, teamsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { CreateTeamNoteBody, UpdateTeamNoteBody } from "@workspace/api-zod";
import { requireAuth, requireManager } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";
import { userCanAccessTeam } from "../lib/permissions";

const router = Router();
const IdParam = z.object({ id: z.string() });

// GET /teams/:id/notes
router.get("/teams/:id/notes", requireAuth, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const teamId = params.data.id;
  const user = req.authUser!;

  if (!(await userCanAccessTeam(user, teamId))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const notes = await db
    .select()
    .from(teamNotesTable)
    .where(eq(teamNotesTable.teamId, teamId))
    .orderBy(desc(teamNotesTable.createdAt));
  res.json(notes);
});

// POST /teams/:id/notes — admin/overseer/leader
router.post("/teams/:id/notes", requireManager, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const teamId = params.data.id;
  const user = req.authUser!;

  if (!(await userCanAccessTeam(user, teamId))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const parsed = CreateTeamNoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [note] = await db
    .insert(teamNotesTable)
    .values({ teamId, authorId: user.id, body: parsed.data.body })
    .returning();

  await logActivity({ user, actionType: "create", entityType: "team_note", entityId: note.id, teamId });
  res.status(201).json(note);
});

// PATCH /team-notes/:id — author or admin
router.patch("/team-notes/:id", requireManager, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const id = params.data.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(teamNotesTable).where(eq(teamNotesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (user.role !== "admin" && existing.authorId !== user.id) {
    res.status(403).json({ error: "Only the author or an admin can edit this note" });
    return;
  }

  const parsed = UpdateTeamNoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [note] = await db
    .update(teamNotesTable)
    .set({ body: parsed.data.body })
    .where(eq(teamNotesTable.id, id))
    .returning();
  res.json(note);
});

// DELETE /team-notes/:id — author or admin
router.delete("/team-notes/:id", requireManager, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const id = params.data.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(teamNotesTable).where(eq(teamNotesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (user.role !== "admin" && existing.authorId !== user.id) {
    res.status(403).json({ error: "Only the author or an admin can delete this note" });
    return;
  }

  await db.delete(teamNotesTable).where(eq(teamNotesTable.id, id));
  await logActivity({ user, actionType: "delete", entityType: "team_note", entityId: id, teamId: existing.teamId });
  res.sendStatus(204);
});

export default router;
