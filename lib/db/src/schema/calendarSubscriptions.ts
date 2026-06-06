import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { programmesTable } from "./programmes";
import { teamsTable } from "./teams";
import { usersTable } from "./users";

export const calendarSubscriptionsTable = pgTable("calendar_subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  feedUrl: text("feed_url").notNull(),
  color: text("color").notNull().default("#2563EB"),
  // Scope: exactly one of programmeId / teamId is set (programme- or
  // team-scoped). Both null is treated as org-wide.
  programmeId: text("programme_id").references(() => programmesTable.id, {
    onDelete: "cascade",
  }),
  teamId: text("team_id").references(() => teamsTable.id, {
    onDelete: "cascade",
  }),
  createdByUserId: text("created_by_user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status")
    .$type<"pending" | "ok" | "error">()
    .notNull()
    .default("pending"),
  lastSyncError: text("last_sync_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCalendarSubscriptionSchema = createInsertSchema(
  calendarSubscriptionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCalendarSubscription = z.infer<
  typeof insertCalendarSubscriptionSchema
>;
export type CalendarSubscription =
  typeof calendarSubscriptionsTable.$inferSelect;
export type CalendarSyncStatus = "pending" | "ok" | "error";
