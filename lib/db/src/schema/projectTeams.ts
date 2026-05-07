import { pgTable, primaryKey, text, timestamp, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { teamsTable } from "./teams";

export const projectTeamsTable = pgTable(
  "project_teams",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teamsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.teamId] }),
    teamIdx: index("project_teams_team_id_idx").on(t.teamId),
  }),
);

export type ProjectTeam = typeof projectTeamsTable.$inferSelect;
