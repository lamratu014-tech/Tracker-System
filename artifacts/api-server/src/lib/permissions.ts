import {
  db,
  teamsTable,
  usersTable,
  streamsTable,
  projectTeamsTable,
  teamManagersTable,
} from "@workspace/db";
import type { Principal } from "./auth";
import { loadManagedTeams } from "./auth";
import { and, eq, inArray } from "drizzle-orm";

/**
 * True when `user` may *read* a project. A project is readable by anyone
 * who can access the owner team OR any of its shared teams.
 */
export async function userCanReadProject(
  user: Principal,
  ownerTeamId: string,
  sharedTeamIds: string[],
): Promise<boolean> {
  if (await userCanAccessTeam(user, ownerTeamId)) return true;
  for (const tid of sharedTeamIds) {
    if (await userCanAccessTeam(user, tid)) return true;
  }
  return false;
}

/** Fetch shared teamIds for a project. */
export async function getProjectSharedTeamIds(projectId: string): Promise<string[]> {
  const rows = await db
    .select({ teamId: projectTeamsTable.teamId })
    .from(projectTeamsTable)
    .where(eq(projectTeamsTable.projectId, projectId));
  return rows.map((r) => r.teamId);
}

async function getStreamProgrammeId(streamId: string): Promise<string | null> {
  const [row] = await db
    .select({ programmeId: streamsTable.programmeId })
    .from(streamsTable)
    .where(eq(streamsTable.id, streamId))
    .limit(1);
  return row?.programmeId ?? null;
}

/** True when `user` directly manages `teamId` (as leader or team_admin). */
function isDirectTeamManager(user: Principal, teamId: string): boolean {
  return (
    user.leaderTeamIds.includes(teamId) || user.teamAdminTeamIds.includes(teamId)
  );
}

/**
 * Returns true when `user` can manage rows scoped to the given team.
 *  - admin              → always
 *  - leader/team_admin  → only teams listed in their team_managers
 *  - stream_overseer    → any team inside their assigned stream
 *  - programme_overseer → any team whose stream is in their assigned programme
 */
export async function userCanAccessTeam(
  user: Principal,
  teamId: string | null | undefined,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (!teamId) return false;
  if (user.role === "leader" || user.role === "team_admin") {
    return isDirectTeamManager(user, teamId);
  }
  if (user.role === "stream_overseer") {
    if (!user.streamId) return false;
    const [team] = await db
      .select({ streamId: teamsTable.streamId })
      .from(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .limit(1);
    return !!team && team.streamId === user.streamId;
  }
  if (user.role === "programme_overseer") {
    if (!user.programmeId) return false;
    const [team] = await db
      .select({ streamId: teamsTable.streamId })
      .from(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .limit(1);
    if (!team?.streamId) return false;
    const programmeId = await getStreamProgrammeId(team.streamId);
    return programmeId === user.programmeId;
  }
  return false;
}

export async function userCanAccessStream(
  user: Principal,
  streamId: string | null | undefined,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (!streamId) return false;
  if (user.role === "stream_overseer") return user.streamId === streamId;
  if (user.role === "programme_overseer") {
    if (!user.programmeId) return false;
    const programmeId = await getStreamProgrammeId(streamId);
    return programmeId === user.programmeId;
  }
  return false;
}

export async function userCanCreateForTeam(
  user: Principal,
  teamId: string | null | undefined,
): Promise<boolean> {
  if (user.role === "admin") return true;
  return userCanAccessTeam(user, teamId);
}

/**
 * Who may add or remove **leaders** on a team:
 *   admin, programme_overseer of containing programme, stream_overseer of
 *   containing stream. Existing leaders / team_admins of the team are NOT
 *   allowed — promoting peers to leader stays an overseer/admin action.
 */
export async function userCanManageTeamLeaders(
  user: Principal,
  teamId: string,
): Promise<boolean> {
  if (user.role === "admin") return true;
  const [team] = await db
    .select({ streamId: teamsTable.streamId })
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId))
    .limit(1);
  if (!team) return false;
  if (user.role === "stream_overseer") {
    return !!user.streamId && team.streamId === user.streamId;
  }
  if (user.role === "programme_overseer") {
    if (!user.programmeId || !team.streamId) return false;
    const programmeId = await getStreamProgrammeId(team.streamId);
    return programmeId === user.programmeId;
  }
  return false;
}

/**
 * Who may add or remove **team_admins** on a team: everyone allowed to
 * manage leaders, PLUS the current leaders of that specific team. A
 * team_admin can NOT promote another user to team_admin — that would let
 * team admins reshape their own access tier without overseer involvement.
 */
export async function userCanManageTeamAdmins(
  user: Principal,
  teamId: string,
): Promise<boolean> {
  if (await userCanManageTeamLeaders(user, teamId)) return true;
  if (user.role === "leader" && user.leaderTeamIds.includes(teamId)) return true;
  return false;
}

/**
 * Validates that `actor` may install `targetUserId` as a manager of a team
 * whose stream is `teamStreamId`, for the given role.
 *
 *  - admin              → always allowed (target must exist & be activatable)
 *  - stream_overseer    → target must be a non-admin user inside the actor's
 *                         stream, AND the team must also be in that stream.
 *  - programme_overseer → target must be a non-admin/non-PO user inside the
 *                         actor's programme, AND the team's stream must be
 *                         in the actor's programme.
 *  - leader             → may only add team_admins (never leaders) to a team
 *                         they themselves lead.
 *  - team_admin         → never allowed.
 */
export async function userCanAssignAsManager(
  actor: Principal,
  targetUserId: string,
  teamId: string,
  teamStreamId: string | null | undefined,
  managerRole: "leader" | "team_admin",
): Promise<{ ok: true } | { ok: false; status: 403 | 404; error: string }> {
  const [target] = await db
    .select({
      id: usersTable.id,
      role: usersTable.role,
      programmeId: usersTable.programmeId,
      streamId: usersTable.streamId,
    })
    .from(usersTable)
    .where(eq(usersTable.id, targetUserId))
    .limit(1);
  if (!target) return { ok: false, status: 404, error: "User not found" };

  if (actor.role === "admin") return { ok: true };

  if (actor.role === "leader") {
    if (managerRole !== "team_admin") {
      return {
        ok: false,
        status: 403,
        error: "Team leaders can only add team admins, not leaders",
      };
    }
    if (!actor.leaderTeamIds.includes(teamId)) {
      return { ok: false, status: 403, error: "You can only add admins to your own team" };
    }
    if (target.role === "admin" || target.role === "programme_overseer") {
      return { ok: false, status: 403, error: "You cannot reassign that user" };
    }
    return { ok: true };
  }

  if (actor.role === "stream_overseer") {
    if (!actor.streamId) {
      return { ok: false, status: 403, error: "Your account is not assigned to a stream" };
    }
    if (teamStreamId !== actor.streamId) {
      return { ok: false, status: 403, error: "Team is outside your stream" };
    }
    if (target.role === "admin") {
      return { ok: false, status: 403, error: "You cannot reassign an admin account" };
    }
    if (target.streamId && target.streamId !== actor.streamId) {
      return { ok: false, status: 403, error: "Target user is in a different stream" };
    }
    return { ok: true };
  }

  if (actor.role === "programme_overseer") {
    if (!actor.programmeId) {
      return { ok: false, status: 403, error: "Your account is not assigned to a programme" };
    }
    if (!teamStreamId) {
      return { ok: false, status: 403, error: "Team is outside your programme" };
    }
    const teamProgrammeId = await getStreamProgrammeId(teamStreamId);
    if (teamProgrammeId !== actor.programmeId) {
      return { ok: false, status: 403, error: "Team is outside your programme" };
    }
    if (target.role === "admin") {
      return { ok: false, status: 403, error: "You cannot reassign an admin account" };
    }
    let targetProgrammeId: string | null = target.programmeId ?? null;
    if (!targetProgrammeId && target.streamId) {
      targetProgrammeId = await getStreamProgrammeId(target.streamId);
    }
    if (!targetProgrammeId) {
      // Fall back to the programme of any team they already manage.
      const managed = await loadManagedTeams(target.id);
      const anyTeam = managed.leaderTeamIds[0] ?? managed.teamAdminTeamIds[0];
      if (anyTeam) {
        const [t] = await db
          .select({ streamId: teamsTable.streamId })
          .from(teamsTable)
          .where(eq(teamsTable.id, anyTeam))
          .limit(1);
        if (t?.streamId) targetProgrammeId = await getStreamProgrammeId(t.streamId);
      }
    }
    if (!targetProgrammeId || targetProgrammeId !== actor.programmeId) {
      return { ok: false, status: 403, error: "Target user is outside your programme" };
    }
    return { ok: true };
  }

  return { ok: false, status: 403, error: "Access denied" };
}

/**
 * True when `user` may read events scoped to a given programme.
 */
export async function userCanAccessProgramme(
  user: Principal,
  programmeId: string | null | undefined,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (!programmeId) return false;
  if (user.role === "programme_overseer") return user.programmeId === programmeId;
  if (user.role === "stream_overseer") {
    if (!user.streamId) return false;
    const sp = await getStreamProgrammeId(user.streamId);
    return sp === programmeId;
  }
  if (user.role === "leader" || user.role === "team_admin") {
    const managedTeamIds = [...user.leaderTeamIds, ...user.teamAdminTeamIds];
    if (managedTeamIds.length === 0) return false;
    const rows = await db
      .select({ streamId: teamsTable.streamId })
      .from(teamsTable)
      .where(inArray(teamsTable.id, managedTeamIds));
    const streamIds = Array.from(new Set(rows.map((r) => r.streamId).filter((s): s is string => !!s)));
    for (const sid of streamIds) {
      const sp = await getStreamProgrammeId(sid);
      if (sp === programmeId) return true;
    }
    return false;
  }
  return false;
}

export async function userCanManageProgramme(
  user: Principal,
  programmeId: string | null | undefined,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (!programmeId) return false;
  if (user.role === "programme_overseer") return user.programmeId === programmeId;
  if (user.role === "stream_overseer") {
    if (!user.streamId) return false;
    const sp = await getStreamProgrammeId(user.streamId);
    return sp === programmeId;
  }
  return false;
}

/** Returns the list of teamIds visible to `user` (admin = all). */
export async function visibleTeamIdsFor(user: Principal): Promise<string[] | "all"> {
  if (user.role === "admin") return "all";
  if (user.role === "programme_overseer") {
    if (!user.programmeId) return [];
    const rows = await db
      .select({ id: teamsTable.id })
      .from(teamsTable)
      .innerJoin(streamsTable, eq(teamsTable.streamId, streamsTable.id))
      .where(eq(streamsTable.programmeId, user.programmeId));
    return rows.map((r) => r.id);
  }
  if (user.role === "stream_overseer") {
    if (!user.streamId) return [];
    const rows = await db
      .select({ id: teamsTable.id })
      .from(teamsTable)
      .where(eq(teamsTable.streamId, user.streamId));
    return rows.map((r) => r.id);
  }
  if (user.role === "leader" || user.role === "team_admin") {
    return Array.from(new Set([...user.leaderTeamIds, ...user.teamAdminTeamIds]));
  }
  return [];
}

export async function userCanReadStream(
  user: Principal,
  streamId: string,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role === "programme_overseer") {
    if (!user.programmeId) return false;
    const sp = await getStreamProgrammeId(streamId);
    return sp === user.programmeId;
  }
  if (user.role === "stream_overseer") return user.streamId === streamId;
  if (user.role === "leader" || user.role === "team_admin") {
    const managedTeamIds = [...user.leaderTeamIds, ...user.teamAdminTeamIds];
    if (managedTeamIds.length === 0) return false;
    const rows = await db
      .select({ id: teamsTable.id })
      .from(teamsTable)
      .where(
        and(inArray(teamsTable.id, managedTeamIds), eq(teamsTable.streamId, streamId)),
      );
    return rows.length > 0;
  }
  return false;
}

/**
 * Fetch leaderIds / teamAdminIds for one or more teams. Returns a Map keyed
 * by teamId; absent teams resolve to empty arrays.
 */
export async function getTeamManagersByTeam(
  teamIds: string[],
): Promise<Map<string, { leaderIds: string[]; teamAdminIds: string[] }>> {
  const result = new Map<string, { leaderIds: string[]; teamAdminIds: string[] }>();
  if (teamIds.length === 0) return result;
  for (const id of teamIds) result.set(id, { leaderIds: [], teamAdminIds: [] });
  const rows = await db
    .select({
      teamId: teamManagersTable.teamId,
      userId: teamManagersTable.userId,
      role: teamManagersTable.role,
    })
    .from(teamManagersTable)
    .where(inArray(teamManagersTable.teamId, teamIds));
  for (const r of rows) {
    const entry = result.get(r.teamId);
    if (!entry) continue;
    if (r.role === "leader") entry.leaderIds.push(r.userId);
    else if (r.role === "team_admin") entry.teamAdminIds.push(r.userId);
  }
  return result;
}
