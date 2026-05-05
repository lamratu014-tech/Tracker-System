import bcrypt from "bcryptjs";
import { db, invitesTable, sessionsTable, usersTable } from "@workspace/db";
import { eq, gt } from "drizzle-orm";
import type { User } from "@workspace/db";

const BCRYPT_ROUNDS = 12;
const SESSION_DAYS = 30;

export function generateToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// 6-char Crockford-ish alphabet (no I, O, 1, 0 to avoid confusion when
// the recipient types the code by hand).
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  const arr = new Uint8Array(6);
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

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  await db.insert(sessionsTable).values({ userId, token, expiresAt });
  return token;
}

export async function getUserFromToken(
  token: string
): Promise<User | null> {
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

  return row.user;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
}

export async function countUsers(): Promise<number> {
  const rows = await db.select({ id: usersTable.id }).from(usersTable);
  return rows.length;
}
