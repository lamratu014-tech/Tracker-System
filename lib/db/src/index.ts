import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Render's managed Postgres requires TLS. node-postgres ignores `sslmode` in
// the connection string, so we promote it to an explicit `ssl` option.
// `rejectUnauthorized: false` is needed for Render's internal hostname (cert
// is valid for the external hostname only).
function buildSsl(connectionString: string): { rejectUnauthorized: boolean } | undefined {
  if (process.env.PGSSL === "disable") return undefined;
  if (process.env.PGSSL === "require") return { rejectUnauthorized: false };
  if (/sslmode=(require|verify-ca|verify-full|prefer)/i.test(connectionString)) {
    return { rejectUnauthorized: false };
  }
  // Auto-enable SSL for known managed providers if the user forgot sslmode.
  if (/(render\.com|neon\.tech|supabase\.co|amazonaws\.com)/i.test(connectionString)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: buildSsl(process.env.DATABASE_URL),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
