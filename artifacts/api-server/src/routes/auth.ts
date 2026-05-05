import { Router } from "express";
import { z } from "zod";
import { db, usersTable, invitesTable, passwordResetsTable, sessionsTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  generateToken,
  countUsers,
} from "../lib/auth";
import { sendInviteEmail, sendPasswordResetEmail } from "../lib/email";
import { requireAuth, requireAdmin } from "../middlewares/requireAuth";

const router = Router();

router.get("/auth/status", async (_req, res): Promise<void> => {
  const count = await countUsers();
  res.json({ needsSetup: count === 0 });
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const AcceptInviteBody = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(8),
});

const SetupBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  department: z.string().optional(),
});

const InviteBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["admin", "manager", "viewer"]),
  department: z.string().optional(),
});

function safeUser(u: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...rest } = u;
  return rest;
}

function getAppDomain(req: import("express").Request): string {
  const host = req.get("host") ?? "localhost";
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  return `${proto}://${host}`;
}

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  res.json(safeUser(req.authUser!));
});

router.post("/auth/setup", async (req, res): Promise<void> => {
  const existing = await countUsers();
  if (existing > 0) {
    res.status(409).json({ error: "App is already set up" });
    return;
  }

  const parsed = SetupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, name, password, department } = parsed.data;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({ email, name, initials, department: department ?? "", role: "admin", passwordHash, active: true })
    .returning();

  const token = await createSession(user.id);
  req.log.info({ userId: user.id }, "First admin account created");
  res.status(201).json({ token, user: safeUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password" });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user || !user.passwordHash || !user.active) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = await createSession(user.id);
  req.log.info({ userId: user.id }, "User logged in");
  res.json({ token, user: safeUser(user) });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  const token = req.headers.authorization!.slice(7);
  await deleteSession(token);
  res.sendStatus(204);
});

router.post("/auth/invite", requireAdmin, async (req, res): Promise<void> => {
  const parsed = InviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, name, role, department } = parsed.data;

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const token = generateToken(24);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);

  await db.insert(invitesTable).values({
    email: email.toLowerCase(),
    name,
    token,
    role,
    department: department ?? "",
    invitedByName: req.authUser!.name,
    expiresAt,
  });

  const acceptUrl = `${getAppDomain(req)}/accept-invite?token=${token}`;
  req.log.info({ email, acceptUrl }, "Invite created");

  await sendInviteEmail({
    toEmail: email,
    toName: name,
    invitedByName: req.authUser!.name,
    role,
    acceptUrl,
  });

  res.status(201).json({ message: "Invite sent", acceptUrl });
});

router.post("/auth/accept-invite", async (req, res): Promise<void> => {
  const parsed = AcceptInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { token, name, password } = parsed.data;
  const now = new Date();

  const [invite] = await db
    .select()
    .from(invitesTable)
    .where(
      and(
        eq(invitesTable.token, token),
        isNull(invitesTable.usedAt),
        gt(invitesTable.expiresAt, now)
      )
    )
    .limit(1);

  if (!invite) {
    res.status(400).json({ error: "Invite link is invalid or has expired" });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, invite.email))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists. Please log in." });
    return;
  }

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(usersTable)
    .values({
      email: invite.email,
      name,
      initials,
      department: invite.department,
      role: invite.role,
      passwordHash,
      active: true,
      invitedByName: invite.invitedByName,
    })
    .returning();

  await db
    .update(invitesTable)
    .set({ usedAt: now })
    .where(eq(invitesTable.id, invite.id));

  const sessionToken = await createSession(user.id);
  req.log.info({ userId: user.id }, "User accepted invite and created account");
  res.status(201).json({ token: sessionToken, user: safeUser(user) });
});

const ForgotPasswordBody = z.object({ email: z.string().email() });
const ResetPasswordBody = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide a valid email address." });
    return;
  }

  const { email } = parsed.data;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  // Always respond with 200 — don't leak whether the email exists
  if (!user || !user.active) {
    res.json({ message: "If that email is registered, a reset link has been sent." });
    return;
  }

  const token = generateToken(32);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  await db.insert(passwordResetsTable).values({ userId: user.id, token, expiresAt });

  const resetUrl = `${getAppDomain(req)}/reset-password?token=${token}`;
  req.log.info({ userId: user.id, resetUrl }, "Password reset token created");

  await sendPasswordResetEmail({ toEmail: user.email, toName: user.name, resetUrl });

  res.json({ message: "If that email is registered, a reset link has been sent.", resetUrl });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { token, password } = parsed.data;
  const now = new Date();

  const [reset] = await db
    .select()
    .from(passwordResetsTable)
    .where(
      and(
        eq(passwordResetsTable.token, token),
        isNull(passwordResetsTable.usedAt),
        gt(passwordResetsTable.expiresAt, now)
      )
    )
    .limit(1);

  if (!reset) {
    res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
    return;
  }

  const passwordHash = await hashPassword(password);

  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, reset.userId));

  await db
    .update(passwordResetsTable)
    .set({ usedAt: now })
    .where(eq(passwordResetsTable.id, reset.id));

  // Invalidate all existing sessions so old devices are logged out
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, reset.userId));

  req.log.info({ userId: reset.userId }, "Password reset successfully");
  res.json({ message: "Password updated. Please sign in with your new password." });
});

router.get("/auth/invite/:token", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const now = new Date();

  const [invite] = await db
    .select()
    .from(invitesTable)
    .where(
      and(
        eq(invitesTable.token, token),
        isNull(invitesTable.usedAt),
        gt(invitesTable.expiresAt, now)
      )
    )
    .limit(1);

  if (!invite) {
    res.status(400).json({ error: "Invite link is invalid or has expired" });
    return;
  }

  res.json({ email: invite.email, name: invite.name, role: invite.role, department: invite.department });
});

export default router;
