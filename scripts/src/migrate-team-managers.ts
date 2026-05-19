/**
 * One-shot migration that introduces the `team_managers` join table and
 * removes the legacy `teams.leader_id` / `users.team_id` columns.
 *
 *  1. Create `team_managers` (composite PK on team_id, user_id; FK cascade
 *     on team/user delete; secondary index on user_id).
 *  2. Backfill from existing `teams.leader_id` rows with role='leader'.
 *  3. Drop `teams.leader_id` and `users.team_id`.
 *
 * Idempotent: re-running is safe because each step uses IF EXISTS / ON
 * CONFLICT and bails out when the source column has already been dropped.
 *
 * Run: `pnpm --filter @workspace/scripts run migrate-team-managers`
 */
import { Pool } from "pg";

function buildSsl(connectionString: string): { rejectUnauthorized: boolean } | undefined {
  if (process.env.PGSSL === "disable") return undefined;
  if (process.env.PGSSL === "strict") return { rejectUnauthorized: true };
  if (process.env.PGSSL === "require") return { rejectUnauthorized: false };
  if (/sslmode=verify-(ca|full)/i.test(connectionString)) return { rejectUnauthorized: true };
  if (/sslmode=(require|prefer)/i.test(connectionString)) return { rejectUnauthorized: false };
  if (/(render\.com|neon\.tech|supabase\.co|amazonaws\.com)/i.test(connectionString)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: url, ssl: buildSsl(url) });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS team_managers (
        team_id    text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role       text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (team_id, user_id)
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS team_managers_user_idx ON team_managers(user_id)`,
    );

    // Backfill from teams.leader_id if the column still exists.
    const { rows: cols } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'teams' AND column_name = 'leader_id'`,
    );
    if (cols.length > 0) {
      const result = await client.query(`
        INSERT INTO team_managers (team_id, user_id, role)
        SELECT id, leader_id, 'leader' FROM teams WHERE leader_id IS NOT NULL
        ON CONFLICT DO NOTHING
      `);
      console.log(`Backfilled ${result.rowCount ?? 0} team_managers rows from teams.leader_id`);
    } else {
      console.log("teams.leader_id already dropped — skipping backfill");
    }

    // Add invite_tokens.team_ids (jsonb array). Backfill from the legacy
    // single team_id column when present, then drop team_id.
    await client.query(
      `ALTER TABLE invite_tokens ADD COLUMN IF NOT EXISTS team_ids jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    const { rows: inviteCols } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'invite_tokens' AND column_name = 'team_id'`,
    );
    if (inviteCols.length > 0) {
      await client.query(
        `UPDATE invite_tokens
            SET team_ids = jsonb_build_array(team_id)
          WHERE team_id IS NOT NULL
            AND (team_ids IS NULL OR team_ids = '[]'::jsonb)`,
      );
      await client.query(`ALTER TABLE invite_tokens DROP COLUMN team_id`);
    }

    await client.query(`ALTER TABLE teams DROP COLUMN IF EXISTS leader_id`);
    await client.query(`ALTER TABLE users DROP COLUMN IF EXISTS team_id`);

    await client.query("COMMIT");
    console.log("team_managers migration complete");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
