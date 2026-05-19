import bcrypt from "bcryptjs";
import { db, invitesTable, sessionsTable, teamManagersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { User } from "@workspace/db";

const BCRYPT_ROUNDS = 12;
const SESSION_DAYS = 30;

/**
 * Authenticated principal: the DB user row plus the lists of teams they
 * manage as leader / team_admin (derived from `team_managers`). These
 * arrays replace the legacy `users.team_id` column that used to pin a
 * leader to exactly one team.
 */
export type Principal = User & {
  leaderTeamIds: string[];
  teamAdminTeamIds: string[];
};

export function generateToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// 16-char Crockford-ish alphabet (no I, O, 1, 0 to avoid visual confusion).
// 32^16 ≈ 2^80 bits of entropy — completely impractical to brute-force online.
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 16;

export function generateInviteCode(): string {
  const arr = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join("");
}

export async function generateUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateInviteCode();
    const [existing] = await db
      .select({ id: invitesTable.id })
      .from(invitesTable)
      .where(eq(invitesTable.token, code))
      .limit(1);
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique invite code");
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  await db.insert(sessionsTable).values({ userId, token, expiresAt });
  return token;
}

/** Load team_managers rows for a user and split by role. */
export async function loadManagedTeams(
  userId: string,
): Promise<{ leaderTeamIds: string[]; teamAdminTeamIds: string[] }> {
  const rows = await db
    .select({ teamId: teamManagersTable.teamId, role: teamManagersTable.role })
    .from(teamManagersTable)
    .where(eq(teamManagersTable.userId, userId));
  const leaderTeamIds: string[] = [];
  const teamAdminTeamIds: string[] = [];
  for (const r of rows) {
    if (r.role === "leader") leaderTeamIds.push(r.teamId);
    else if (r.role === "team_admin") teamAdminTeamIds.push(r.teamId);
  }
  return { leaderTeamIds, teamAdminTeamIds };
}

/** Wrap a raw user row with derived team_managers arrays. */
export async function toPrincipal(user: User): Promise<Principal> {
  const managed = await loadManagedTeams(user.id);
  return { ...user, ...managed };
}

export async function getUserFromToken(token: string): Promise<Principal | null> {
  const now = new Date();
  const [row] = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(eq(sessionsTable.token, token))
    .limit(1);

  if (!row) return null;
  if (new Date(row.user.createdAt) > now) return null; // shouldn't happen

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token))
    .limit(1);

  if (!session || session.expiresAt < now) return null;
  if (!row.user.active) return null;

  return toPrincipal(row.user);
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
}

export async function countUsers(): Promise<number> {
  const rows = await db.select({ id: usersTable.id }).from(usersTable);
  return rows.length;
}
