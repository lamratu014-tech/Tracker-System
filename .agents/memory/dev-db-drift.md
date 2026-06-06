---
name: Dev DB drift vs schema sources
description: The Replit dev Postgres is out of sync with lib/db schema sources; db push is blocked interactively.
---

# Dev DB drift in this environment

The Replit dev Postgres lags behind `lib/db/src/schema/*`. Two known gaps observed:

- `team_managers` table can be **entirely missing** from the dev DB even though
  `teamManagers.ts` defines it. Auth breaks for *every* request when it's gone —
  `loadManagedTeams` in `artifacts/api-server/src/lib/auth.ts` queries it inside
  `requireAuth`, so all authenticated routes 500 with `relation "team_managers"
  does not exist` until the table exists.
- `invite_tokens` has legacy single-team `team_id text` in the DB while
  `invites.ts` defines multi-team `team_ids jsonb`. This is another (unmerged)
  task's migration.

**Why it matters:** `pnpm --filter @workspace/db run push` stalls on an
interactive rename prompt for the `invite_tokens` `team_id → team_ids` drift, so
a plain push can't be completed non-interactively, and answering the rename
either way risks that other task's data.

**How to apply:** When you only need to add your *own* new table, create it with
explicit DDL via `psql "$DATABASE_URL"` matching the Drizzle schema (column
names, FKs with ON DELETE CASCADE, named PK/unique constraints/indexes). That's
purely additive and avoids the risky invite rename. Do **not** resolve the
invite_tokens rename as a side effect of an unrelated task. If auth is 500ing in
a dev test, check `team_managers` exists first — recreate it additively if not.
