import { db, activityLogsTable } from "@workspace/db";
import type { User } from "@workspace/db";

export async function logActivity(opts: {
  user: User;
  actionType: string;
  entityType: string;
  entityId?: string;
  entityTitle?: string;
  description?: string;
  teamId?: string | null;
}): Promise<void> {
  try {
    await db.insert(activityLogsTable).values({
      userId: opts.user.id,
      userRole: opts.user.role,
      userName: opts.user.name,
      actionType: opts.actionType,
      entityType: opts.entityType,
      entityId: opts.entityId,
      entityTitle: opts.entityTitle,
      description: opts.description,
      teamId: opts.teamId ?? opts.user.teamId,
    });
  } catch {
    // Activity logging should never crash the main request
  }
}
