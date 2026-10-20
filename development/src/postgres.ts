import pg from "pg";
import { applyMigrations, type Database, type Queryable, type MigrationTransaction } from "./database.js";

export interface PostgresSettings {
  connectionString: string;
  ca?: string;
  max?: number;
  /** Test-only escape hatch, restricted to an explicit loopback URL. Never used by hosted startup. */
  localTest?: boolean;
}
export function postgresPoolOptions(settings: PostgresSettings): pg.PoolConfig {
  let url: URL;
  try { url = new URL(settings.connectionString); } catch { throw new Error("Invalid PostgreSQL configuration"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || url.pathname.length < 2)
    throw new Error("Invalid PostgreSQL configuration");
  const local = settings.localTest === true;
  if (local && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Local database tests require loopback");
  // pg connection-string SSL options otherwise override the explicit TLS object.
  for (const key of [...url.searchParams.keys()]) {
    if (key === "sslmode" && url.searchParams.get(key) === "verify-full") url.searchParams.delete(key);
    else throw new Error("Remove PostgreSQL URL options; TLS and timeouts are configured explicitly");
  }
  const max = settings.max ?? 3;
  if (!Number.isInteger(max) || max < 1 || max > 5) throw new Error("Invalid PostgreSQL pool limit");
  return {
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: true, ...(settings.ca ? { ca: settings.ca } : {}) },
    max, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000,
    application_name: "emerald-synthetic-staging",
    // Keep date-only values independent of the process timezone; timestamps remain JSON strings.
    types: { getTypeParser: ((oid: number, format: "text" | "binary" = "text") =>
      format === "text" && [1082, 1114, 1184].includes(oid) ? (value: string) => value : pg.types.getTypeParser(oid, format)) as typeof pg.types.getTypeParser },
  };
}
export function openPostgres(settings: PostgresSettings): Database & { pool: pg.Pool } {
  const pool = new pg.Pool(postgresPoolOptions(settings));
  // Do not log pg messages: they can include connection or customer details.
  pool.on("error", () => console.error(JSON.stringify({ event: "database_idle_connection_error" })));
  const wrap = (client: pg.PoolClient): MigrationTransaction => ({
    query: (async (sql: string, args?: unknown[]) => ({ rows: (await client.query(sql, args)).rows })) as Queryable["query"],
    exec: async sql => { await client.query(sql); },
  });
  const transaction: Database["transaction"] = async work => {
    const client = await pool.connect();
    let discard = false;
    try {
      // Transaction-local settings work with transaction poolers; no session state leaks.
      await client.query("BEGIN; SET LOCAL TIME ZONE 'UTC'; SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='5s'; SET LOCAL idle_in_transaction_session_timeout='20s'");
      const result = await work(wrap(client));
      if ((await client.query("COMMIT")).command !== "COMMIT") throw new Error("Transaction did not commit");
      return result;
    } catch (error) {
      // Unknown commit outcome is never retried here; the API's same-key retry owns deduplication.
      try { await client.query("ROLLBACK"); } catch { discard = true; }
      throw error;
    } finally { client.release(discard); }
  };
  return {
    pool,
    // Even standalone reads get server-side bounds without unsupported pooler startup parameters.
    query: (async (sql: string, args?: unknown[]) => transaction(tx => tx.query(sql, args))) as Queryable["query"],
    transaction,
    close: () => pool.end(),
  };
}
export async function migratePostgres(db: Database) {
  await db.transaction(async tx => {
    await tx.query("SELECT pg_advisory_xact_lock(91873, 1)");
    await applyMigrations(tx as MigrationTransaction);
  });
}
export async function verifyRuntimeRole(db: Queryable) {
  const row = (await db.query<{ unsafe: boolean }>(`SELECT (
    r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolbypassrls
    OR has_schema_privilege(current_user,'public','CREATE')
    OR has_table_privilege(current_user,'public.audit_events','UPDATE,DELETE,TRUNCATE')
    OR has_table_privilege(current_user,'public.schema_migrations','INSERT,UPDATE,DELETE,TRUNCATE')
    OR pg_has_role(current_user,c.relowner,'MEMBER')
    ) AS unsafe FROM pg_roles r CROSS JOIN pg_class c
    WHERE r.rolname=current_user AND c.oid='public.audit_events'::regclass`)).rows[0];
  if (!row || row.unsafe) throw new Error("Runtime database role must be restricted");
}
export async function verifySyntheticWorkspace(db: Queryable) {
  const rows = (await db.query<{ name: string }>("SELECT name FROM organizations")).rows;
  if (rows.length !== 1 || rows[0].name !== "Emerald Interlink · Synthetic review workspace")
    throw new Error("Only the dedicated synthetic staging workspace is supported");
}
