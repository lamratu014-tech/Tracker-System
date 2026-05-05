import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";

export const personnelTable = pgTable("assigned_personnel", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  roleLabel: text("role_label"),
  teamId: text("team_id")
    .notNull()
    .references(() => teamsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Personnel = typeof personnelTable.$inferSelect;
