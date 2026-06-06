---
name: Dev DB drift vs schema sources
description: The Replit dev Postgres can lag lib/db schema sources after task merges; db push may stall on an interactive rename prompt.
---

# Dev DB drift in this environment

Task agents create new tables/columns via DDL in their *isolated* environments,
but only **code** merges back — schema changes do **not**. So after a feature
task merges, the main dev Postgres can be missing tables/columns that the merged
code now requires. Symptoms seen: `team_managers`, `weekly_updates` tables
missing; `events.recurrence_freq/recurrence_until` columns missing.

When `team_managers` is gone, auth breaks for *every* request — `loadManagedTeams`
in `requireAuth` queries it, so all authenticated routes 500 and the mobile
dashboard (which gates on `useMe()`) renders blank. If a UI change "isn't
showing up" after a merge, suspect broken auth from missing tables, not the UI.

**Why `db push` doesn't just fix it:** `pnpm --filter @workspace/db run push`
stalls on an interactive prompt for the `invite_tokens` `team_id → team_ids`
rename, so it can't complete non-interactively.

**How to apply:** Reconcile the main dev DB with explicit additive DDL via
`psql "$DATABASE_URL"`, matching the Drizzle schema (column names, FKs with
ON DELETE CASCADE, named PK/unique constraints/indexes). Use `IF NOT EXISTS` so
it's idempotent. For the invite rename specifically: add `team_ids jsonb NOT
NULL DEFAULT '[]'`, backfill `jsonb_build_array(team_id)` where set, then drop
`team_id` (invites are ephemeral, so this is safe). After fixing, restart the
api-server workflow and confirm `GET /api/auth/status` → 200 and an
authenticated route → 401 (not 500).
