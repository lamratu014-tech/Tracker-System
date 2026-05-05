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
