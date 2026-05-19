import { db, teamManagersTable, type User } from "@workspace/db";
import { inArray } from "drizzle-orm";

/**
 * Shape we return for User-typed API responses. Matches the OpenAPI
 * `User` schema: no passwordHash, plus the derived leaderTeamIds /
 * teamAdminTeamIds arrays from team_managers.
 */
export type SafeUser = Omit<User, "passwordHash"> & {
  leaderTeamIds: string[];
  teamAdminTeamIds: string[];
};

function strip(u: User): Omit<User, "passwordHash"> {
  const { passwordHash: _ph, ...rest } = u;
  return rest;
}

/** Enrich a single user row. Single round trip to team_managers. */
export async function enrichUser(u: User): Promise<SafeUser> {
  const rows = await db
    .select({ teamId: teamManagersTable.teamId, role: teamManagersTable.role })
    .from(teamManagersTable)
    .where(inArray(teamManagersTable.userId, [u.id]));
  const leaderTeamIds: string[] = [];
  const teamAdminTeamIds: string[] = [];
  for (const r of rows) {
    if (r.role === "leader") leaderTeamIds.push(r.teamId);
    else if (r.role === "team_admin") teamAdminTeamIds.push(r.teamId);
  }
  return { ...strip(u), leaderTeamIds, teamAdminTeamIds };
}

/** Enrich many user rows with a single bulk lookup. */
export async function enrichUsers(users: User[]): Promise<SafeUser[]> {
  if (users.length === 0) return [];
  const ids = users.map((u) => u.id);
  const rows = await db
    .select({
      userId: teamManagersTable.userId,
      teamId: teamManagersTable.teamId,
      role: teamManagersTable.role,
    })
    .from(teamManagersTable)
    .where(inArray(teamManagersTable.userId, ids));
  const map = new Map<string, { leaderTeamIds: string[]; teamAdminTeamIds: string[] }>();
  for (const id of ids) map.set(id, { leaderTeamIds: [], teamAdminTeamIds: [] });
  for (const r of rows) {
    const entry = map.get(r.userId);
    if (!entry) continue;
    if (r.role === "leader") entry.leaderTeamIds.push(r.teamId);
    else if (r.role === "team_admin") entry.teamAdminTeamIds.push(r.teamId);
  }
  return users.map((u) => {
    const m = map.get(u.id)!;
    return { ...strip(u), leaderTeamIds: m.leaderTeamIds, teamAdminTeamIds: m.teamAdminTeamIds };
  });
}

/**
 * Public projection used when a non-admin viewer fetches another user.
 * Same shape as SafeUser but with HR-style fields blanked out.
 */
export function toPublicUser(u: SafeUser): SafeUser {
  return {
    ...u,
    email: "",
    department: "",
    invitedByName: null,
  };
}
