import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { userRoles, type UserRole } from "./users";

export const invitesTable = pgTable("invite_tokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  name: text("name").notNull().default(""),
  role: text("role")
    .$type<UserRole>()
    .notNull()
    .default("leader"),
  department: text("department").notNull().default(""),
  programmeId: text("programme_id"),
  streamId: text("stream_id"),
  // Teams the invitee should be auto-added to as a manager on accept.
  // Stored as a JSON array of teamIds. Empty for non-leader/team_admin roles.
  teamIds: jsonb("team_ids").$type<string[]>().notNull().default([]),
  invitedByName: text("invited_by_name").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export { userRoles };
export type Invite = typeof invitesTable.$inferSelect;
