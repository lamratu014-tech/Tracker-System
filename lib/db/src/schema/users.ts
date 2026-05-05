import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { streamsTable } from "./streams";

export const userRoles = ["admin", "stream_overseer", "leader"] as const;
export type UserRole = (typeof userRoles)[number];

export const usersTable = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  department: text("department").notNull().default(""),
  role: text("role")
    .$type<UserRole>()
    .notNull()
    .default("leader"),
  streamId: text("stream_id").references(() => streamsTable.id, {
    onDelete: "set null",
  }),
  teamId: text("team_id"),
  passwordHash: text("password_hash"),
  active: boolean("active").notNull().default(true),
  invitedByName: text("invited_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
