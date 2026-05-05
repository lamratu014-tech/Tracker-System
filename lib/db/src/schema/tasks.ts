import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { personnelTable } from "./personnel";

export const tasksTable = pgTable("tasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status")
    .$type<"todo" | "in_progress" | "at_risk" | "done">()
    .notNull()
    .default("todo"),
  priority: text("priority")
    .$type<"low" | "medium" | "high">()
    .notNull()
    .default("medium"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  assignedToUserId: text("assigned_to_user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  assignedToMemberId: text("assigned_to_member_id").references(
    () => personnelTable.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Task = typeof tasksTable.$inferSelect;
export type TaskStatus = "todo" | "in_progress" | "at_risk" | "done";
export type TaskPriority = "low" | "medium" | "high";
