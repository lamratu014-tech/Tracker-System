import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";
import { usersTable } from "./users";

export const teamNotesTable = pgTable("team_notes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  teamId: text("team_id")
    .notNull()
    .references(() => teamsTable.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type TeamNote = typeof teamNotesTable.$inferSelect;
