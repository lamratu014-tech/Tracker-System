import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

function buildSsl(connectionString: string): { rejectUnauthorized: boolean } | undefined {
  if (process.env.PGSSL === "disable") return undefined;
  if (process.env.PGSSL === "strict") return { rejectUnauthorized: true };
  if (process.env.PGSSL === "require") return { rejectUnauthorized: false };
  if (/sslmode=verify-(ca|full)/i.test(connectionString)) {
    return { rejectUnauthorized: true };
  }
  if (/sslmode=(require|prefer)/i.test(connectionString)) {
    return { rejectUnauthorized: false };
  }
  if (/(render\.com|neon\.tech|supabase\.co|amazonaws\.com)/i.test(connectionString)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: buildSsl(process.env.DATABASE_URL),
  },
});
