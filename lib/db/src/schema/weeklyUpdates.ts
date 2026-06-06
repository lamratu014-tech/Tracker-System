import { pgTable, text, timestamp, date, unique } from "drizzle-orm/pg-core";
import { streamsTable } from "./streams";
import { usersTable } from "./users";

/**
 * Weekly status updates authored by stream overseers. Exactly one update
 * per overseer per week (enforced by the unique constraint). `weekStart`
 * is the Monday of the covered week, stored as a plain calendar date
 * (YYYY-MM-DD) computed server-side so updates can't be backdated.
 */
export const weeklyUpdatesTable = pgTable(
  "weekly_updates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    authorId: text("author_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    streamId: text("stream_id")
      .notNull()
      .references(() => streamsTable.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    uniqAuthorWeek: unique("weekly_updates_author_week_unique").on(
      t.authorId,
      t.weekStart,
    ),
  }),
);

export type WeeklyUpdate = typeof weeklyUpdatesTable.$inferSelect;
