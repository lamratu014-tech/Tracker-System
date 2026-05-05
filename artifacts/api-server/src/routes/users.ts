import { Router } from "express";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireProgrammeLead } from "../middlewares/requireAuth";

const router = Router();

function safeUser(u: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...rest } = u;
  return rest;
}

router.get("/users", requireProgrammeLead, async (_req, res): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  res.json(users.map(safeUser));
});

const UpdateRoleBody = z.object({
  role: z.enum(["programme_lead", "team_lead"]),
  teamId: z.string().optional().nullable(),
});

router.patch("/users/:id/role", requireProgrammeLead, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (id === req.authUser!.id) {
    res.status(400).json({ error: "You cannot change your own role" });
    return;
  }

  const parsed = UpdateRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ role: parsed.data.role, teamId: parsed.data.teamId ?? undefined })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  req.log.info({ targetId: id, role: parsed.data.role }, "Role updated");
  res.json(safeUser(user));
});

router.patch("/users/:id/deactivate", requireProgrammeLead, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (id === req.authUser!.id) {
    res.status(400).json({ error: "You cannot deactivate your own account" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ active: false })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  req.log.info({ targetId: id }, "User deactivated");
  res.json(safeUser(user));
});

router.patch("/users/:id/reactivate", requireProgrammeLead, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [user] = await db
    .update(usersTable)
    .set({ active: true })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  req.log.info({ targetId: id }, "User reactivated");
  res.json(safeUser(user));
});

router.delete("/users/:id", requireProgrammeLead, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (id === req.authUser!.id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  const [user] = await db
    .delete(usersTable)
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  req.log.info({ targetId: id }, "User deleted");
  res.sendStatus(204);
});

export default router;
