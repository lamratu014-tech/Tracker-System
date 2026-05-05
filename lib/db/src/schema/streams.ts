import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { programmesTable } from "./programmes";

export const streamsTable = pgTable("streams", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  programmeId: text("programme_id")
    .notNull()
    .references(() => programmesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Stream = typeof streamsTable.$inferSelect;
