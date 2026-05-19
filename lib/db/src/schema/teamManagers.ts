import { pgTable, text, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";
import { usersTable } from "./users";

export const teamManagerRoles = ["leader", "team_admin"] as const;
export type TeamManagerRole = (typeof teamManagerRoles)[number];

export const teamManagersTable = pgTable(
  "team_managers",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => teamsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role").$type<TeamManagerRole>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.teamId, t.userId] }),
    userIdx: index("team_managers_user_idx").on(t.userId),
  }),
);

export type TeamManager = typeof teamManagersTable.$inferSelect;
