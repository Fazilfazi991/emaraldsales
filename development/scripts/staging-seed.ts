import { mkdir, open } from "node:fs/promises";
import { openPostgres, postgresPoolOptions } from "../src/postgres.js";
import { verifyMigrations } from "../src/database.js";
import { seedSynthetic } from "../src/fixtures.js";

if (process.env.CRM_HOSTED_STAGE !== "approved-synthetic-staging" || process.env.CONFIRM_STAGING_SEED !== "yes")
  throw new Error("Explicit empty synthetic staging seed approval is required");
// Deliberately refuses to overwrite an existing credentials file, before touching the DB.
const settings = { connectionString: process.env.MIGRATION_DATABASE_URL ?? "", ca: process.env.DATABASE_SSL_CA, max: 1 };
postgresPoolOptions(settings);
await mkdir(".local", { recursive: true });
const credentials = await open(".local/staging-accounts.json", "wx", 0o600);
const db = openPostgres(settings);
try {
  await verifyMigrations(db);
  const fixture = await seedSynthetic(db, 700);
  await credentials.writeFile(JSON.stringify(fixture, null, 2));
  console.log("700 synthetic shops and demo accounts prepared. Credentials are in the ignored .local/staging-accounts.json file; deliver privately.");
} catch {
  console.error("Synthetic preparation failed. Do not rerun blindly; check the empty-database requirement and private credentials file.");
  process.exitCode = 1;
} finally { await credentials.close(); await db.close(); }
