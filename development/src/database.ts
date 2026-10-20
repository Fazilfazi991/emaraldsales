import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile, mkdir, open, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";

/** Only this adapter knows the local engine. Services depend on Queryable. */
export interface Queryable {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}
export interface Database extends Queryable {
  transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function openDatabase(path?: string): Promise<Database> {
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
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const directory = new URL("../migrations/", import.meta.url);
  for (const name of (await readdir(directory))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(new URL(name, directory), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    await db.transaction(async (tx) => {
      const row = (
        await tx.query<{ sha256: string }>(
          "SELECT sha256 FROM schema_migrations WHERE name=$1",
          [name],
        )
      ).rows[0];
      if (row && row.sha256 !== hash)
        throw new Error(`Applied migration changed: ${name}`);
      if (row) return;
      // Migration SQL is a trusted, versioned file; PGlite query accepts a single statement.
      await (tx as Queryable & { exec(sql: string): Promise<unknown> }).exec(
        sql,
      );
      await tx.query(
        "INSERT INTO schema_migrations(name,sha256) VALUES ($1,$2)",
        [name, hash],
      );
    });
  }
}
