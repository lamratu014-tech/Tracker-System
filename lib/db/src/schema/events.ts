import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";
import { projectsTable } from "./projects";
import { programmesTable } from "./programmes";
import { usersTable } from "./users";

export const eventsTable = pgTable("events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  internalDescription: text("internal_description").notNull().default(""),
  sharedDescription: text("shared_description").notNull().default(""),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  location: text("location").notNull().default(""),
  color: text("color").notNull().default("#2563EB"),
  isAllDay: boolean("is_all_day").notNull().default(false),
  status: text("status")
    .$type<"pending" | "approved" | "rejected">()
    .notNull()
    .default("pending"),
  recurrenceFreq: text("recurrence_freq")
    .$type<"none" | "daily" | "weekly" | "monthly" | "yearly">()
    .notNull()
    .default("none"),
  recurrenceUntil: timestamp("recurrence_until", { withTimezone: true }),
  projectId: text("project_id").references(() => projectsTable.id, {
    onDelete: "set null",
  }),
  programmeId: text("programme_id").references(() => programmesTable.id, {
    onDelete: "set null",
  }),
  createdByTeamId: text("created_by_team_id").references(() => teamsTable.id, {
    onDelete: "set null",
  }),
  createdByUserId: text("created_by_user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const eventInvitationsTable = pgTable("event_invitations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id")
    .notNull()
    .references(() => eventsTable.id, { onDelete: "cascade" }),
  teamId: text("team_id")
    .notNull()
    .references(() => teamsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Event = typeof eventsTable.$inferSelect;
export type EventInvitation = typeof eventInvitationsTable.$inferSelect;
export type EventStatus = "pending" | "approved" | "rejected";
