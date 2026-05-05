import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const invitesTable = pgTable("invite_tokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  name: text("name").notNull().default(""),
  role: text("role")
    .$type<"admin" | "manager" | "viewer">()
    .notNull()
    .default("viewer"),
  department: text("department").notNull().default(""),
  invitedByName: text("invited_by_name").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Invite = typeof invitesTable.$inferSelect;
