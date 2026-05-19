import { useGetMe, useListStreams } from "@workspace/api-client-react";
import type { User, Stream } from "@workspace/api-client-react";

export type Principal =
  | Pick<User, "id" | "role" | "programmeId" | "streamId" | "leaderTeamIds" | "teamAdminTeamIds">
  | null
  | undefined;

export type StreamScope = { id: string; programmeId?: string | null };
export type TeamScope = { id: string; streamId?: string | null };

function managedTeamIds(user: Principal): string[] {
  if (!user) return [];
  return [...(user.leaderTeamIds ?? []), ...(user.teamAdminTeamIds ?? [])];
}

function leaderTeamIds(user: Principal): string[] {
  return user?.leaderTeamIds ?? [];
}

/**
 * Pure permission helpers. Programme-overseer checks require the caller to
 * provide the stream's `programmeId` (directly for streams, or as the
 * `streamProgrammeId` argument for teams). When that information is
 * missing, the helper conservatively returns `false` — the server is the
 * final authority and will reject any request that doesn't actually fall
 * inside the user's programme.
 */
export function canManageEverything(user: Principal): boolean {
  return user?.role === "admin";
}

export function canManageStream(
  user: Principal,
  stream: StreamScope | string | null | undefined,
): boolean {
  if (!user || !stream) return false;
  if (user.role === "admin") return true;
  const streamId = typeof stream === "string" ? stream : stream.id;
  const streamProgrammeId =
    typeof stream === "string" ? null : stream.programmeId ?? null;
  if (user.role === "programme_overseer") {
    if (!user.programmeId || !streamProgrammeId) return false;
    return streamProgrammeId === user.programmeId;
  }
  if (user.role === "stream_overseer") return user.streamId === streamId;
  return false;
}

export function canManageTeam(
  user: Principal,
  team: TeamScope | null | undefined,
  streamProgrammeId?: string | null,
): boolean {
  if (!user || !team) return false;
  if (user.role === "admin") return true;
  if (user.role === "programme_overseer") {
    if (!user.programmeId || !streamProgrammeId) return false;
    return streamProgrammeId === user.programmeId;
  }
  if (user.role === "stream_overseer") {
    return !!team.streamId && team.streamId === user.streamId;
  }
  if (user.role === "leader" || user.role === "team_admin") {
    return managedTeamIds(user).includes(team.id);
  }
  return false;
}

export function canCreateForTeam(
  user: Principal,
  team: TeamScope | null | undefined,
  streamProgrammeId?: string | null,
): boolean {
  if (!user) return false;
  if (!team) return user.role === "admin";
  return canManageTeam(user, team, streamProgrammeId);
}

/**
 * Only admin / programme-overseer / stream-overseer / current team leaders
 * may add or remove team managers (leaders + team admins). A team_admin
 * specifically may NOT add other managers.
 */
export function canManageTeamManagers(
  user: Principal,
  team: TeamScope | null | undefined,
  streamProgrammeId?: string | null,
): boolean {
  if (!user || !team) return false;
  if (user.role === "admin") return true;
  if (user.role === "programme_overseer") {
    if (!user.programmeId || !streamProgrammeId) return false;
    return streamProgrammeId === user.programmeId;
  }
  if (user.role === "stream_overseer") {
    return !!team.streamId && team.streamId === user.streamId;
  }
  if (user.role === "leader") {
    return leaderTeamIds(user).includes(team.id);
  }
  return false;
}

export function useMe(): User | null {
  const { data } = useGetMe();
  return data ?? null;
}

export function useCanManageEverything(): boolean {
  return canManageEverything(useMe());
}

/**
 * React variants resolve the stream's programmeId via `useListStreams`
 * so callers can keep passing just an ID. Returns `false` while the list
 * is still loading.
 */
export function useCanManageStream(streamId: string | null | undefined): boolean {
  const me = useMe();
  const { data: streams } = useListStreams();
  if (!me || !streamId) return false;
  if (me.role === "admin") return true;
  if (me.role === "stream_overseer") return me.streamId === streamId;
  if (me.role === "programme_overseer") {
    const stream = (streams as Stream[] | undefined)?.find((s) => s.id === streamId);
    if (!stream || !me.programmeId) return false;
    return stream.programmeId === me.programmeId;
  }
  return false;
}

export function useCanManageTeam(
  team: TeamScope | null | undefined,
): boolean {
  const me = useMe();
  const { data: streams } = useListStreams();
  if (!me || !team) return false;
  const streamProgrammeId =
    team.streamId
      ? (streams as Stream[] | undefined)?.find((s) => s.id === team.streamId)?.programmeId ?? null
      : null;
  return canManageTeam(me, team, streamProgrammeId);
}

export function useCanCreateForTeam(
  team: TeamScope | null | undefined,
): boolean {
  const me = useMe();
  const { data: streams } = useListStreams();
  if (!me) return false;
  if (!team) return me.role === "admin";
  const streamProgrammeId =
    team.streamId
      ? (streams as Stream[] | undefined)?.find((s) => s.id === team.streamId)?.programmeId ?? null
      : null;
  return canCreateForTeam(me, team, streamProgrammeId);
}

export function useCanManageTeamManagers(
  team: TeamScope | null | undefined,
): boolean {
  const me = useMe();
  const { data: streams } = useListStreams();
  if (!me) return false;
  const streamProgrammeId =
    team?.streamId
      ? (streams as Stream[] | undefined)?.find((s) => s.id === team.streamId)?.programmeId ?? null
      : null;
  return canManageTeamManagers(me, team, streamProgrammeId);
}

export type TeamVisibility = "full" | "locked" | "hidden";

/**
 * How a team should be presented to a given user.
 *
 * - `full`   — show all detail and allow navigation to the team page.
 * - `locked` — show only the team's name + leader on a list, with a lock
 *              indicator; do not navigate, do not expose other detail.
 * - `hidden` — do not render the team at all.
 *
 * Admins always full. Stream overseers full inside their stream. Programme
 * overseers full inside their programme (caller must provide
 * `streamProgrammeId` for that to resolve). Leaders + team_admins see
 * their own teams as full and sibling teams in their stream as locked.
 */
export function teamVisibility(
  user: Principal,
  team: TeamScope | null | undefined,
  streamProgrammeId?: string | null,
): TeamVisibility {
  if (!user || !team) return "hidden";
  if (user.role === "admin") return "full";
  if (user.role === "programme_overseer") {
    if (user.programmeId && streamProgrammeId && streamProgrammeId === user.programmeId) {
      return "full";
    }
    return "hidden";
  }
  if (user.role === "stream_overseer") {
    if (team.streamId && team.streamId === user.streamId) return "full";
    return "hidden";
  }
  if (user.role === "leader" || user.role === "team_admin") {
    if (managedTeamIds(user).includes(team.id)) return "full";
    if (team.streamId && user.streamId && team.streamId === user.streamId) {
      return "locked";
    }
    return "hidden";
  }
  return "hidden";
}

export function useTeamVisibility(
  team: TeamScope | null | undefined,
): TeamVisibility {
  const me = useMe();
  const { data: streams } = useListStreams();
  const streamProgrammeId =
    team?.streamId
      ? (streams as Stream[] | undefined)?.find((s) => s.id === team.streamId)?.programmeId ?? null
      : null;
  return teamVisibility(me, team, streamProgrammeId);
}
