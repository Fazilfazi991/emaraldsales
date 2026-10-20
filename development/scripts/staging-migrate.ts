import { openPostgres, migratePostgres } from "../src/postgres.js";
import { verifyMigrations } from "../src/database.js";

// Operator-only command. This URL must never be configured in a Vercel function.
if (process.env.CRM_HOSTED_STAGE !== "approved-synthetic-staging" || process.env.CONFIRM_STAGING_MIGRATION !== "yes")
  throw new Error("Explicit synthetic staging migration approval is required");
const db = openPostgres({ connectionString: process.env.MIGRATION_DATABASE_URL ?? "", ca: process.env.DATABASE_SSL_CA, max: 1 });
try {
  await migratePostgres(db);
  await verifyMigrations(db);
  console.log("Staging migrations and checksums verified. No accounts or customer records were created.");
} catch {
  console.error("Staging migration failed. Review the database securely; connection details are not logged.");
  process.exitCode = 1;
} finally { await db.close(); }
