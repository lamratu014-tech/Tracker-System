import { useGetMe } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

export type Principal = Pick<User, "id" | "role" | "streamId" | "teamId"> | null | undefined;

export function canManageEverything(user: Principal): boolean {
  return user?.role === "admin";
}

export function canManageStream(user: Principal, streamId: string | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!streamId) return false;
  if (user.role === "stream_overseer") return user.streamId === streamId;
  return false;
}

export function canManageTeam(
  user: Principal,
  team: { id: string; streamId?: string | null } | null | undefined,
): boolean {
  if (!user || !team) return false;
  if (user.role === "admin") return true;
  if (user.role === "leader") return user.teamId === team.id;
  if (user.role === "stream_overseer") {
    return !!team.streamId && team.streamId === user.streamId;
  }
  return false;
}

export function canCreateForTeam(
  user: Principal,
  team: { id: string; streamId?: string | null } | null | undefined,
): boolean {
  if (!user) return false;
  if (!team) return user.role === "admin";
  return canManageTeam(user, team);
}

export function useMe(): User | null {
  const { data } = useGetMe();
  return data ?? null;
}

export function useCanManageEverything(): boolean {
  return canManageEverything(useMe());
}

export function useCanManageStream(streamId: string | null | undefined): boolean {
  return canManageStream(useMe(), streamId);
}

export function useCanManageTeam(
  team: { id: string; streamId?: string | null } | null | undefined,
): boolean {
  return canManageTeam(useMe(), team);
}

export function useCanCreateForTeam(
  team: { id: string; streamId?: string | null } | null | undefined,
): boolean {
  return canCreateForTeam(useMe(), team);
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
 * Admins and stream overseers always get `full` (no visibility scoping).
 * Leaders see their own team as `full`, sibling teams in their stream as
 * `locked`, and any team outside their stream as `hidden`.
 */
export function teamVisibility(
  user: Principal,
  team: { id: string; streamId?: string | null } | null | undefined,
): TeamVisibility {
  if (!user || !team) return "hidden";
  if (user.role === "admin") return "full";
  if (user.role === "stream_overseer") return "full";
  if (user.role === "leader") {
    if (user.teamId && user.teamId === team.id) return "full";
    if (team.streamId && user.streamId && team.streamId === user.streamId) {
      return "locked";
    }
    return "hidden";
  }
  return "hidden";
}

export function useTeamVisibility(
  team: { id: string; streamId?: string | null } | null | undefined,
): TeamVisibility {
  return teamVisibility(useMe(), team);
}
