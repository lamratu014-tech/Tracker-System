import { Router } from "express";
import { db, usersTable, invitesTable, passwordResetsTable, sessionsTable, teamsTable, streamsTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import {
  LoginBody,
  SetupFirstAdminBody,
  AcceptInviteBody,
  CreateInviteBody,
  RequestPasswordResetBody,
  ResetPasswordBody,
  GetInviteByTokenParams,
} from "@workspace/api-zod";
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  generateToken,
  generateUniqueInviteCode,
  countUsers,
} from "../lib/auth";
import { sendInviteEmail, sendPasswordResetEmail } from "../lib/email";
import { requireAuth, requireManager } from "../middlewares/requireAuth";

const router = Router();

router.get("/auth/status", async (_req, res): Promise<void> => {
  const count = await countUsers();
  res.json({ needsSetup: count === 0 });
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
  const configuredSecret = process.env["SETUP_SECRET"];
  if (!configuredSecret) {
    res.status(503).json({ error: "Setup is not available. SETUP_SECRET is not configured." });
    return;
  }

  const existing = await countUsers();
  if (existing > 0) {
    res.status(409).json({ error: "App is already set up" });
    return;
  }

  const parsed = SetupFirstAdminBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, name, password, department, setupSecret } = parsed.data;

  if (setupSecret !== configuredSecret) {
    res.status(403).json({ error: "Invalid setup secret." });
    return;
  }
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

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

router.post("/auth/invite", requireManager, async (req, res): Promise<void> => {
  const parsed = CreateInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, name, role, department, streamId, teamId } = parsed.data;
  const inviter = req.authUser!;

  // Leaders can never invite anyone.
  if (inviter.role === "leader") {
    res.status(403).json({ error: "Team leaders cannot invite users" });
    return;
  }

  // Validate scope coherence and that referenced rows exist. We only
  // load the team when we actually need its streamId for cross-checks.
  let resolvedStreamId: string | null = null;

  if (role === "admin") {
    if (streamId || teamId) {
      res.status(400).json({ error: "Admin invites cannot be scoped to a stream or team" });
      return;
    }
  } else if (role === "stream_overseer") {
    if (!streamId) {
      res.status(400).json({ error: "Stream overseer invites must include a streamId" });
      return;
    }
    if (teamId) {
      res.status(400).json({ error: "Stream overseer invites cannot include a teamId" });
      return;
    }
    const [stream] = await db
      .select({ id: streamsTable.id })
      .from(streamsTable)
      .where(eq(streamsTable.id, streamId))
      .limit(1);
    if (!stream) {
      res.status(400).json({ error: "Stream not found" });
      return;
    }
    resolvedStreamId = streamId;
  } else if (role === "leader") {
    if (!teamId) {
      res.status(400).json({ error: "Leader invites must include a teamId" });
      return;
    }
    const [team] = await db
      .select()
      .from(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .limit(1);
    if (!team) {
      res.status(400).json({ error: "Team not found" });
      return;
    }
    if (streamId && team.streamId && streamId !== team.streamId) {
      res.status(400).json({ error: "streamId does not match the team's stream" });
      return;
    }
    resolvedStreamId = team.streamId ?? streamId ?? null;
  }

  // Inviter-role authorization. Admins may invite anyone; stream
  // overseers may only invite within their own stream.
  if (inviter.role === "stream_overseer") {
    if (role === "admin") {
      res.status(403).json({ error: "Stream overseers cannot invite admins" });
      return;
    }
    if (!inviter.streamId) {
      res.status(403).json({ error: "Your account is not assigned to a stream" });
      return;
    }
    if (resolvedStreamId !== inviter.streamId) {
      res.status(403).json({ error: "You can only invite users within your own stream" });
      return;
    }
  }

  const lowerEmail = email.toLowerCase();
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, lowerEmail))
    .limit(1);
  // Active accounts (or anyone with a passwordHash) cannot be re-invited;
  // an inactive, never-redeemed account is allowed to be re-invited so a
  // lost code or expired invite isn't a permanent dead-end.
  if (existing && (existing.active || existing.passwordHash)) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  // Re-invite of a pre-existing inactive user is privileged: the
  // inviter must also have authority over the *existing* row's scope,
  // not just the new requested scope. Otherwise an overseer could
  // overwrite a pending admin invite (or a pending user in a different
  // stream) by re-inviting the same email into their own stream.
  if (existing) {
    if (existing.role === "admin" && inviter.role !== "admin") {
      res.status(403).json({ error: "Only admins can re-invite an admin account" });
      return;
    }
    if (
      inviter.role === "stream_overseer" &&
      existing.streamId &&
      existing.streamId !== inviter.streamId
    ) {
      res.status(403).json({ error: "This pending account is in a different stream" });
      return;
    }
    if (
      inviter.role === "stream_overseer" &&
      existing.role === "stream_overseer" &&
      existing.streamId !== inviter.streamId
    ) {
      res.status(403).json({ error: "Stream overseers can only re-invite within their own stream" });
      return;
    }
  }

  const token = await generateUniqueInviteCode();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  // Provision (or refresh) an inactive user row alongside the invite so
  // the account exists from invitation time. The user has no
  // passwordHash and active=false, which means `/auth/login` will reject
  // them until they redeem the invite. Wrap in a transaction so we never
  // end up with an orphan user row if invite insert fails. Map Postgres
  // unique-violation (23505) to a clean 409 in case a concurrent invite
  // beats the pre-check above.
  try {
    await db.transaction(async (tx) => {
      if (existing) {
        // Re-invite path: refresh role/scope on the inactive shell and
        // wipe any prior outstanding invite codes for this email so only
        // the new code is valid.
        await tx
          .update(usersTable)
          .set({
            name,
            initials,
            department: department ?? "",
            role,
            streamId: resolvedStreamId,
            teamId: teamId ?? null,
            invitedByName: req.authUser!.name,
          })
          .where(eq(usersTable.id, existing.id));
        await tx
          .delete(invitesTable)
          .where(and(eq(invitesTable.email, lowerEmail), isNull(invitesTable.usedAt)));
      } else {
        await tx.insert(usersTable).values({
          email: lowerEmail,
          name,
          initials,
          department: department ?? "",
          role,
          streamId: resolvedStreamId,
          teamId: teamId ?? null,
          passwordHash: null,
          active: false,
          invitedByName: req.authUser!.name,
        });
      }
      await tx.insert(invitesTable).values({
        email: lowerEmail,
        name,
        token,
        role,
        department: department ?? "",
        streamId: resolvedStreamId,
        teamId: teamId ?? null,
        invitedByName: req.authUser!.name,
        expiresAt,
      });
    });
  } catch (err) {
    const e = err as { code?: string; constraint?: string; constraint_name?: string } | null;
    if (e?.code === "23505") {
      const constraint = e.constraint ?? e.constraint_name ?? "";
      if (constraint.includes("token")) {
        // Astronomically rare: invite-code collision after pre-check.
        res.status(503).json({ error: "Could not allocate an invite code, please retry" });
        return;
      }
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    throw err;
  }

  const acceptUrl = `${getAppDomain(req)}/accept-invite?token=${token}`;
  req.log.info({ email }, "Invite created");

  // Email delivery is strictly best-effort — surfacing the code in-app
  // is the primary handoff, so a transport failure must not 500 the
  // request and lose the code.
  try {
    await sendInviteEmail({
      toEmail: email,
      toName: name,
      invitedByName: req.authUser!.name,
      role,
      acceptUrl,
    });
  } catch (err) {
    req.log.warn({ err, email }, "Invite email send failed; continuing");
  }

  res.status(201).json({ message: "Invite sent", acceptUrl, code: token });
});

router.post("/auth/accept-invite", async (req, res): Promise<void> => {
  const parsed = AcceptInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { token, password } = parsed.data;
  const normalizedToken = token.trim().toUpperCase();

  // Pre-flight invite check before paying for bcrypt — invalid/expired
  // codes must not waste CPU and become a brute-force amplifier.
  const [preflight] = await db
    .select({ id: invitesTable.id })
    .from(invitesTable)
    .where(
      and(
        eq(invitesTable.token, normalizedToken),
        isNull(invitesTable.usedAt),
        gt(invitesTable.expiresAt, new Date())
      )
    )
    .limit(1);
  if (!preflight) {
    res.status(400).json({ error: "Invite link is invalid or has expired" });
    return;
  }

  const passwordHash = await hashPassword(password);

  // Activate the pre-provisioned user, consume the invite, and create
  // a session in a single transaction so concurrent redemptions can't
  // both succeed and so a partial failure can't leave an orphan token.
  let result: { userId: string } | { error: string; status: number };
  try {
    result = await db.transaction(async (tx) => {
      const now = new Date();
      const [invite] = await tx
        .select()
        .from(invitesTable)
        .where(
          and(
            eq(invitesTable.token, normalizedToken),
            isNull(invitesTable.usedAt),
            gt(invitesTable.expiresAt, now)
          )
        )
        .limit(1);
      if (!invite) {
        return { error: "Invite link is invalid or has expired", status: 400 };
      }

      const [pending] = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, invite.email))
        .limit(1);
      if (!pending) {
        return { error: "Invite link is invalid or has expired", status: 400 };
      }
      if (pending.active || pending.passwordHash) {
        return {
          error: "An account with this email already exists. Please log in.",
          status: 409,
        };
      }

      await tx
        .update(usersTable)
        .set({ passwordHash, active: true })
        .where(eq(usersTable.id, pending.id));
      await tx
        .update(invitesTable)
        .set({ usedAt: now })
        .where(eq(invitesTable.id, invite.id));

      return { userId: pending.id };
    });
  } catch (err) {
    req.log.error({ err }, "accept-invite transaction failed");
    res.status(500).json({ error: "Could not activate your account" });
    return;
  }

  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, result.userId)).limit(1);
  const sessionToken = await createSession(result.userId);
  req.log.info({ userId: result.userId }, "User accepted invite and activated account");
  res.status(201).json({ token: sessionToken, user: safeUser(user) });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = RequestPasswordResetBody.safeParse(req.body);
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
  req.log.info({ userId: user.id }, "Password reset token created");

  await sendPasswordResetEmail({ toEmail: user.email, toName: user.name, resetUrl });

  res.json({ message: "If that email is registered, a reset link has been sent." });
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
  const params = GetInviteByTokenParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const now = new Date();
  const normalized = params.data.token.trim().toUpperCase();

  const [invite] = await db
    .select()
    .from(invitesTable)
    .where(
      and(
        eq(invitesTable.token, normalized),
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
