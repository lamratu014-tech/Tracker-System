import { Router } from "express";
import {
  db,
  usersTable,
  invitesTable,
  passwordResetsTable,
  sessionsTable,
  teamsTable,
  streamsTable,
  programmesTable,
  teamManagersTable,
} from "@workspace/db";
import { eq, and, gt, inArray, isNull } from "drizzle-orm";
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
import { requireAuth } from "../middlewares/requireAuth";
import { enrichUser } from "../lib/safeUser";

const router = Router();

router.get("/auth/status", async (_req, res): Promise<void> => {
  const count = await countUsers();
  res.json({ needsSetup: count === 0 });
});

function getAppDomain(): string {
  const configured = process.env["APP_DOMAIN"];
  if (configured) return configured.replace(/\/$/, "");
  return "https://localhost";
}

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  // req.authUser is already a Principal with leaderTeamIds/teamAdminTeamIds.
  const { passwordHash: _ph, leaderTeamIds, teamAdminTeamIds, ...rest } = req.authUser!;
  res.json({ ...rest, leaderTeamIds, teamAdminTeamIds });
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
  res.status(201).json({ token, user: await enrichUser(user) });
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
  res.json({ token, user: await enrichUser(user) });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  const token = req.headers.authorization!.slice(7);
  await deleteSession(token);
  res.sendStatus(204);
});

router.post("/auth/invite", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, name, role, department, programmeId, streamId } = parsed.data;
  // Normalise team scope: accept either the legacy singular `teamId` or the
  // new `teamIds` array. Deduped.
  const teamIds = Array.from(
    new Set([
      ...((parsed.data.teamIds ?? []) as string[]),
      ...(parsed.data.teamId ? [parsed.data.teamId] : []),
    ]),
  );
  const inviter = req.authUser!;

  // Who may invite whom:
  //   admin              → any role
  //   programme_overseer → stream_overseer / leader / team_admin in own programme
  //   stream_overseer    → stream_overseer / leader / team_admin in own stream
  //   leader             → team_admin only, for teams they lead
  if (
    inviter.role !== "admin" &&
    inviter.role !== "programme_overseer" &&
    inviter.role !== "stream_overseer" &&
    inviter.role !== "leader"
  ) {
    res.status(403).json({ error: "You do not have permission to invite users" });
    return;
  }
  if (
    (inviter.role === "programme_overseer" || inviter.role === "stream_overseer") &&
    (role === "admin" || role === "programme_overseer")
  ) {
    res.status(403).json({ error: "You cannot invite that role" });
    return;
  }
  if (inviter.role === "leader") {
    if (role !== "team_admin") {
      res.status(403).json({ error: "Team leaders can only invite team admins" });
      return;
    }
    if (teamIds.length === 0) {
      res.status(400).json({ error: "Team admin invites must include at least one teamId" });
      return;
    }
    for (const tid of teamIds) {
      if (!inviter.leaderTeamIds.includes(tid)) {
        res.status(403).json({ error: "You can only invite team admins to your own teams" });
        return;
      }
    }
  }

  let resolvedProgrammeId: string | null = null;
  let resolvedStreamId: string | null = null;

  if (role === "admin") {
    if (programmeId || streamId || teamIds.length > 0) {
      res.status(400).json({ error: "Admin invites cannot be scoped to a programme, stream or team" });
      return;
    }
  } else if (role === "programme_overseer") {
    if (!programmeId) {
      res.status(400).json({ error: "Programme overseer invites must include a programmeId" });
      return;
    }
    if (streamId || teamIds.length > 0) {
      res.status(400).json({ error: "Programme overseer invites cannot include a streamId or teamId" });
      return;
    }
    const [programme] = await db
      .select({ id: programmesTable.id })
      .from(programmesTable)
      .where(eq(programmesTable.id, programmeId))
      .limit(1);
    if (!programme) { res.status(400).json({ error: "Programme not found" }); return; }
    resolvedProgrammeId = programmeId;
  } else if (role === "stream_overseer") {
    if (!streamId) {
      res.status(400).json({ error: "Stream overseer invites must include a streamId" });
      return;
    }
    if (teamIds.length > 0) {
      res.status(400).json({ error: "Stream overseer invites cannot include a teamId" });
      return;
    }
    const [stream] = await db
      .select({ id: streamsTable.id, programmeId: streamsTable.programmeId })
      .from(streamsTable)
      .where(eq(streamsTable.id, streamId))
      .limit(1);
    if (!stream) { res.status(400).json({ error: "Stream not found" }); return; }
    if (inviter.role === "programme_overseer" && stream.programmeId !== inviter.programmeId) {
      res.status(403).json({ error: "Stream is outside your programme" }); return;
    }
    if (inviter.role === "stream_overseer" && streamId !== inviter.streamId) {
      res.status(403).json({ error: "Stream is outside your stream" }); return;
    }
    resolvedStreamId = streamId;
  } else if (role === "leader" || role === "team_admin") {
    if (teamIds.length === 0) {
      res.status(400).json({ error: `${role} invites must include at least one teamId` });
      return;
    }
    const teamRows = await db
      .select({ id: teamsTable.id, streamId: teamsTable.streamId })
      .from(teamsTable)
      .where(inArray(teamsTable.id, teamIds));
    if (teamRows.length !== teamIds.length) {
      res.status(400).json({ error: "One or more teams were not found" }); return;
    }
    const streamIds = Array.from(new Set(teamRows.map((t) => t.streamId).filter((s): s is string => !!s)));
    // For non-admin inviters, every chosen team must live in their scope.
    if (inviter.role === "stream_overseer") {
      if (streamIds.some((sid) => sid !== inviter.streamId)) {
        res.status(403).json({ error: "Teams must all be in your stream" }); return;
      }
    } else if (inviter.role === "programme_overseer") {
      if (!inviter.programmeId || streamIds.length === 0) {
        res.status(403).json({ error: "Teams are outside your programme" }); return;
      }
      const streamProgRows = await db
        .select({ id: streamsTable.id, programmeId: streamsTable.programmeId })
        .from(streamsTable)
        .where(inArray(streamsTable.id, streamIds));
      if (streamProgRows.some((s) => s.programmeId !== inviter.programmeId)) {
        res.status(403).json({ error: "Teams are outside your programme" }); return;
      }
    }
    resolvedStreamId = streamIds.length === 1 ? streamIds[0]! : null;
  }

  const lowerEmail = email.toLowerCase();
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, lowerEmail))
    .limit(1);
  if (existing && (existing.active || existing.passwordHash)) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const token = await generateUniqueInviteCode();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  try {
    await db.transaction(async (tx) => {
      if (existing) {
        await tx
          .update(usersTable)
          .set({
            name,
            initials,
            department: department ?? "",
            role,
            programmeId: resolvedProgrammeId,
            streamId: resolvedStreamId,
            invitedByName: inviter.name,
          })
          .where(eq(usersTable.id, existing.id));
        // Wipe any previously-staged team_managers rows so the invite is the
        // single source of truth for the team list.
        await tx.delete(teamManagersTable).where(eq(teamManagersTable.userId, existing.id));
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
          programmeId: resolvedProgrammeId,
          streamId: resolvedStreamId,
          passwordHash: null,
          active: false,
          invitedByName: inviter.name,
        });
      }
      await tx.insert(invitesTable).values({
        email: lowerEmail,
        name,
        token,
        role,
        department: department ?? "",
        programmeId: resolvedProgrammeId,
        streamId: resolvedStreamId,
        teamIds,
        invitedByName: inviter.name,
        expiresAt,
      });
    });
  } catch (err) {
    const e = err as { code?: string; constraint?: string; constraint_name?: string } | null;
    if (e?.code === "23505") {
      const constraint = e.constraint ?? e.constraint_name ?? "";
      if (constraint.includes("token")) {
        res.status(503).json({ error: "Could not allocate an invite code, please retry" });
        return;
      }
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    throw err;
  }

  const acceptUrl = `${getAppDomain()}/accept-invite?token=${token}`;
  req.log.info({ email }, "Invite created");

  try {
    await sendInviteEmail({
      toEmail: email,
      toName: name,
      invitedByName: inviter.name,
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
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { token, password } = parsed.data;
  const normalizedToken = token.trim().toUpperCase();

  const [preflight] = await db
    .select({ id: invitesTable.id })
    .from(invitesTable)
    .where(
      and(
        eq(invitesTable.token, normalizedToken),
        isNull(invitesTable.usedAt),
        gt(invitesTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!preflight) {
    res.status(400).json({ error: "Invite link is invalid or has expired" });
    return;
  }

  const passwordHash = await hashPassword(password);

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
            gt(invitesTable.expiresAt, now),
          ),
        )
        .limit(1);
      if (!invite) return { error: "Invite link is invalid or has expired", status: 400 };

      const [pending] = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, invite.email))
        .limit(1);
      if (!pending) return { error: "Invite link is invalid or has expired", status: 400 };
      if (pending.active || pending.passwordHash) {
        return { error: "An account with this email already exists. Please log in.", status: 409 };
      }

      await tx
        .update(usersTable)
        .set({ passwordHash, active: true })
        .where(eq(usersTable.id, pending.id));
      await tx
        .update(invitesTable)
        .set({ usedAt: now })
        .where(eq(invitesTable.id, invite.id));

      // Materialise the invite's teamIds into team_managers rows for
      // leader / team_admin invites. Other roles ignore teamIds.
      const teamIds = (invite.teamIds ?? []) as string[];
      if (
        teamIds.length > 0 &&
        (invite.role === "leader" || invite.role === "team_admin")
      ) {
        await tx.insert(teamManagersTable).values(
          teamIds.map((teamId) => ({
            teamId,
            userId: pending.id,
            role: invite.role as "leader" | "team_admin",
          })),
        ).onConflictDoNothing();
      }

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
  res.status(201).json({ token: sessionToken, user: await enrichUser(user) });
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

  if (!user || !user.active) {
    res.json({ message: "If that email is registered, a reset link has been sent." });
    return;
  }

  const token = generateToken(32);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  await db.insert(passwordResetsTable).values({ userId: user.id, token, expiresAt });

  const resetUrl = `${getAppDomain()}/reset-password?token=${token}`;
  req.log.info({ userId: user.id }, "Password reset token created");

  await sendPasswordResetEmail({ toEmail: user.email, toName: user.name, resetUrl });

  res.json({ message: "If that email is registered, a reset link has been sent." });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { token, password } = parsed.data;
  const now = new Date();

  const [reset] = await db
    .select()
    .from(passwordResetsTable)
    .where(
      and(
        eq(passwordResetsTable.token, token),
        isNull(passwordResetsTable.usedAt),
        gt(passwordResetsTable.expiresAt, now),
      ),
    )
    .limit(1);

  if (!reset) {
    res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
    return;
  }

  const passwordHash = await hashPassword(password);

  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, reset.userId));
  await db
    .update(passwordResetsTable)
    .set({ usedAt: now })
    .where(eq(passwordResetsTable.id, reset.id));
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
        gt(invitesTable.expiresAt, now),
      ),
    )
    .limit(1);

  if (!invite) {
    res.status(400).json({ error: "Invite link is invalid or has expired" });
    return;
  }

  res.json({ email: invite.email, name: invite.name, role: invite.role, department: invite.department });
});

export default router;
