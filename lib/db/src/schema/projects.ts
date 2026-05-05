import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";

export const projectsTable = pgTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  teamId: text("team_id")
    .notNull()
    .references(() => teamsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status")
    .$type<"not_started" | "in_progress" | "at_risk" | "completed">()
    .notNull()
    .default("not_started"),
  color: text("color").notNull().default("#2563EB"),
  phase: text("phase").notNull().default(""),
  dueDate: timestamp("due_date", { withTimezone: true }),
  notes: text("notes").notNull().default(""),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Project = typeof projectsTable.$inferSelect;
export type ProjectStatus = "not_started" | "in_progress" | "at_risk" | "completed";
