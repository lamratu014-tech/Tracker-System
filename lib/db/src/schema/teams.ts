import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { streamsTable } from "./streams";

export const teamsTable = pgTable("teams", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  streamId: text("stream_id").references(() => streamsTable.id, { onDelete: "set null" }),
  functionLabel: text("function_label"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Team = typeof teamsTable.$inferSelect;
