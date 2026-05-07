import { db, teamsTable, usersTable, streamsTable, projectTeamsTable } from "@workspace/db";
import type { User } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * True when `user` may *read* a project. A project is readable by anyone
 * who can access the owner team OR any of its shared teams.
 */
export async function userCanReadProject(
  user: User,
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

/**
 * Look up the programmeId for a stream, or null if the stream is missing.
 */
async function getStreamProgrammeId(streamId: string): Promise<string | null> {
  const [row] = await db
    .select({ programmeId: streamsTable.programmeId })
    .from(streamsTable)
    .where(eq(streamsTable.id, streamId))
    .limit(1);
  return row?.programmeId ?? null;
}

/**
 * Returns true when `user` can manage rows scoped to the given team.
 *  - admin              → always
 *  - leader             → only their own team
 *  - stream_overseer    → any team inside their assigned stream
 *  - programme_overseer → any team whose stream is in their assigned programme
 */
export async function userCanAccessTeam(
  user: User,
  teamId: string | null | undefined
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (!teamId) return false;
  if (user.role === "leader") return user.teamId === teamId;
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

/** Same as userCanAccessTeam but for an entire stream. Async because the
 * programme_overseer branch needs the stream's programme. */
export async function userCanAccessStream(
  user: User,
  streamId: string | null | undefined
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

/**
 * True when `user` can create entities directly under a team — admins
 * always, otherwise the same scope as `userCanAccessTeam`. Mirrors the
 * mobile `canCreateForTeam` helper.
 */
export async function userCanCreateForTeam(
  user: User,
  teamId: string | null | undefined
): Promise<boolean> {
  if (user.role === "admin") return true;
  return userCanAccessTeam(user, teamId);
}

/**
 * Validates that `actor` may install `targetUserId` as the leader of a team
 * whose stream is `teamStreamId`.
 *  - admin              → always allowed (target must still exist)
 *  - stream_overseer    → target must be a non-admin user inside the actor's
 *                         stream, AND the team must also be in that stream.
 *  - programme_overseer → target must be a non-admin/non-programme_overseer
 *                         user, AND the team's stream must be in the actor's
 *                         programme. Target must not belong to a different
 *                         programme.
 *  - leader             → never allowed.
 */
export async function userCanAssignAsLeader(
  actor: User,
  targetUserId: string,
  teamStreamId: string | null | undefined
): Promise<{ ok: true } | { ok: false; status: 403 | 404; error: string }> {
  const [target] = await db
    .select({
      id: usersTable.id,
      role: usersTable.role,
      programmeId: usersTable.programmeId,
      streamId: usersTable.streamId,
      teamId: usersTable.teamId,
    })
    .from(usersTable)
    .where(eq(usersTable.id, targetUserId))
    .limit(1);
  if (!target) return { ok: false, status: 404, error: "User not found" };

  if (actor.role === "admin") return { ok: true };

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
    // PO may install any non-admin user from inside their programme as a
    // leader (including another programme_overseer of the same programme).
    if (target.role === "admin") {
      return { ok: false, status: 403, error: "You cannot reassign an admin account" };
    }
    // Resolve the target's effective programme. We must not rely solely on
    // target.programmeId — many users (stream_overseer, leader) have it null
    // and live inside a programme via their stream/team. Without this chain
    // a PO could otherwise assign a stream_overseer from a different
    // programme as leader of one of their own teams.
    let targetProgrammeId: string | null = target.programmeId ?? null;
    if (!targetProgrammeId && target.streamId) {
      targetProgrammeId = await getStreamProgrammeId(target.streamId);
    }
    if (!targetProgrammeId && target.teamId) {
      const [tt] = await db
        .select({ streamId: teamsTable.streamId })
        .from(teamsTable)
        .where(eq(teamsTable.id, target.teamId))
        .limit(1);
      if (tt?.streamId) {
        targetProgrammeId = await getStreamProgrammeId(tt.streamId);
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
 *  - admin              → always
 *  - programme_overseer → only their assigned programme
 *  - stream_overseer    → the programme that contains their assigned stream
 *  - leader             → the programme that contains their team's stream
 */
export async function userCanAccessProgramme(
  user: User,
  programmeId: string | null | undefined
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (!programmeId) return false;
  if (user.role === "programme_overseer") return user.programmeId === programmeId;
  if (user.role === "stream_overseer") {
    if (!user.streamId) return false;
    const sp = await getStreamProgrammeId(user.streamId);
    return sp === programmeId;
  }
  if (user.role === "leader") {
    if (!user.teamId) return false;
    const [team] = await db
      .select({ streamId: teamsTable.streamId })
      .from(teamsTable)
      .where(eq(teamsTable.id, user.teamId))
      .limit(1);
    if (!team?.streamId) return false;
    const sp = await getStreamProgrammeId(team.streamId);
    return sp === programmeId;
  }
  return false;
}

/**
 * True when `user` may *manage* (create/update/delete) entities scoped to a
 * programme — admins always, programme overseers for their own programme,
 * stream overseers for the programme containing their stream. Leaders cannot
 * manage programme-scoped entities.
 */
export async function userCanManageProgramme(
  user: User,
  programmeId: string | null | undefined
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
export async function visibleTeamIdsFor(user: User): Promise<string[] | "all"> {
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
  if (user.role === "leader" && user.teamId) return [user.teamId];
  return [];
}

/**
 * True when `user` may read a given stream.
 *  - admin              → always
 *  - programme_overseer → any stream in their assigned programme
 *  - stream_overseer    → only their assigned stream
 *  - leader             → only the stream that contains their team
 */
export async function userCanReadStream(
  user: User,
  streamId: string
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role === "programme_overseer") {
    if (!user.programmeId) return false;
    const sp = await getStreamProgrammeId(streamId);
    return sp === user.programmeId;
  }
  if (user.role === "stream_overseer") return user.streamId === streamId;
  if (user.role === "leader") {
    if (!user.teamId) return false;
    const [team] = await db
      .select({ streamId: teamsTable.streamId })
      .from(teamsTable)
      .where(eq(teamsTable.id, user.teamId))
      .limit(1);
    return !!team && team.streamId === streamId;
  }
  return false;
}
