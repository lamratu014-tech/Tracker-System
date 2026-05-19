import { db, activityLogsTable } from "@workspace/db";
import type { Principal } from "./auth";

export async function logActivity(opts: {
  user: Principal;
  actionType: string;
  entityType: string;
  entityId?: string;
  entityTitle?: string;
  description?: string;
  teamId?: string | null;
}): Promise<void> {
  try {
    // Fall back to the first team the actor manages so activity entries
    // still attach to a sensible scope when the caller doesn't supply one.
    const fallbackTeamId =
      opts.user.leaderTeamIds[0] ?? opts.user.teamAdminTeamIds[0] ?? null;
    await db.insert(activityLogsTable).values({
      userId: opts.user.id,
      userRole: opts.user.role,
      userName: opts.user.name,
      actionType: opts.actionType,
      entityType: opts.entityType,
      entityId: opts.entityId,
      entityTitle: opts.entityTitle,
      description: opts.description,
      teamId: opts.teamId ?? fallbackTeamId,
    });
  } catch {
    // Activity logging should never crash the main request
  }
}
