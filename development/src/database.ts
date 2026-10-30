import { readdir, readFile, mkdir, open, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";

/** Only this adapter knows the local engine. Services depend on Queryable. */
export interface Queryable {
  /** Optional optimized single-statement read. Transactions retain their own query method. */
  read?: Queryable['query'];
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}
export function readQuery<T=Record<string,unknown>>(db:Queryable,sql:string,params?:unknown[]){
  return db.read ? db.read<T>(sql,params) : db.query<T>(sql,params);
}
export interface Database extends Queryable {
  transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export interface MigrationTransaction extends Queryable {
  exec(sql: string): Promise<unknown>;
}
export async function openDatabase(path?: string): Promise<Database> {
  // The embedded local engine must never slow down hosted PostgreSQL startup.
  const {PGlite}=await import("@electric-sql/pglite");
  let release = async () => {};
  if (path) {
    await mkdir(dirname(path), { recursive: true });
    const lockPath = `${path}.lock`;
    try {
      const lock = await open(lockPath, "wx");
      await lock.writeFile(String(process.pid));
      await lock.close();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const pid = Number(await readFile(lockPath, "utf8"));
      let alive = true;
      try {
        process.kill(pid, 0);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ESRCH") alive = false;
      }
      if (alive || !Number.isInteger(pid) || pid < 1)
        throw new Error(
          "Database is already open. Stop the local server before running database commands.",
        );
      await unlink(lockPath);
      const lock = await open(lockPath, "wx");
      await lock.writeFile(String(process.pid));
      await lock.close();
    }
    release = async () => {
      await unlink(lockPath);
    };
  }
  try {
    const engine = new PGlite(path);
    await engine.waitReady;
    await engine.exec("SET TIME ZONE 'UTC'");
    return {
      query: engine.query.bind(engine),
      transaction: engine.transaction.bind(engine) as Database["transaction"],
      close: async () => {
        await engine.close();
        await release();
      },
    };
  } catch (error) {
    await release();
    throw error;
  }
}
export async function migrate(db: Database) {
  await db.transaction((tx) => applyMigrations(tx as MigrationTransaction));
}
/** Caller owns the transaction and, on network PostgreSQL, the migration lock. */
export async function applyMigrations(tx: MigrationTransaction) {
  await tx.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const directory = new URL("../migrations/", import.meta.url);
  for (const name of (await readdir(directory))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(new URL(name, directory), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    const row = (
      await tx.query<{ sha256: string }>(
        "SELECT sha256 FROM schema_migrations WHERE name=$1",
        [name],
      )
    ).rows[0];
    if (row && row.sha256 !== hash)
      throw new Error(`Applied migration changed: ${name}`);
    if (row) continue;
    // Migration SQL is a trusted, versioned file; PGlite query accepts a single statement.
    await tx.exec(sql);
    await tx.query(
      "INSERT INTO schema_migrations(name,sha256) VALUES ($1,$2)",
      [name, hash],
    );
  }
}
/** Read-only startup check: never create schema or modify a migration at runtime. */
export async function verifyMigrations(db: Queryable) {
  const directory = new URL("../migrations/", import.meta.url);
  const files = (await readdir(directory)).filter(n => n.endsWith(".sql")).sort();
  const rows = (await db.query<{ name: string; sha256: string }>(
    "SELECT name,sha256 FROM schema_migrations ORDER BY name",
  )).rows;
  if (rows.length !== files.length) throw new Error("Schema verification failed");
  for (const [index, name] of files.entries()) {
    const hash = createHash("sha256").update(await readFile(new URL(name, directory))).digest("hex");
    if (rows[index]?.name !== name || rows[index]?.sha256 !== hash)
      throw new Error("Schema verification failed");
  }
}
