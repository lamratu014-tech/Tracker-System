import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
  teamId: text("team_id"),
  invitedByName: text("invited_by_name").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export { userRoles };
export type Invite = typeof invitesTable.$inferSelect;
