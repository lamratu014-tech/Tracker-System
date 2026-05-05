import { Router } from "express";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireProgrammeLead } from "../middlewares/requireAuth";
import { hashPassword } from "../lib/auth";

const router = Router();

function safeUser(u: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...rest } = u;
  return rest;
}

const CreateUserBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["programme_lead", "team_lead"]),
  department: z.string().optional(),
  teamId: z.string().optional().nullable(),
});

router.post("/users", requireProgrammeLead, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { email, name, password, role, department, teamId } = parsed.data;

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase(),
      name,
      initials,
      passwordHash,
      role,
      department: department ?? "",
      teamId: teamId ?? null,
      active: true,
      invitedByName: req.authUser!.name,
    })
    .returning();

  req.log.info({ userId: user!.id }, "User created directly by programme lead");
  res.status(201).json(safeUser(user!));
});

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
