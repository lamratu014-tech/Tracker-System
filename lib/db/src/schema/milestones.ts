import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const milestonesTable = pgTable("milestones", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Milestone = typeof milestonesTable.$inferSelect;
