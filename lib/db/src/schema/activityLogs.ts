import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const activityLogsTable = pgTable("activity_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userRole: text("user_role"),
  userName: text("user_name"),
  actionType: text("action_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  entityTitle: text("entity_title"),
  description: text("description"),
  teamId: text("team_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ActivityLog = typeof activityLogsTable.$inferSelect;
