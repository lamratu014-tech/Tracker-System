import { db, teamsTable } from "@workspace/db";
import type { User } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Returns true when `user` can manage rows scoped to the given team.
 *  - admin            → always
 *  - leader           → only their own team
 *  - stream_overseer  → any team inside their assigned stream
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
  return false;
}

/** Same as userCanAccessTeam but for an entire stream (overseer of that stream or admin). */
export function userCanAccessStream(
  user: User,
  streamId: string | null | undefined
): boolean {
  if (user.role === "admin") return true;
  if (!streamId) return false;
  if (user.role === "stream_overseer") return user.streamId === streamId;
  return false;
}
