import type { IncomingMessage, ServerResponse, RequestListener } from "node:http";
import { attachDatabasePool } from "@vercel/functions";
import { hostedConfig } from "./hosted-config.js";
import { openPostgres, verifyRuntimeRole, verifySyntheticWorkspace } from "./postgres.js";
import { verifyMigrations } from "./database.js";
import { requestHandler } from "./server.js";
import { unavailable } from "./unavailable.js";

let ready: Promise<RequestListener> | undefined;
class StartupFailure extends Error {
  constructor(readonly stage: string) { super("Hosted initialization failed"); }
}
async function initialize(): Promise<RequestListener> {
  let stage = "configuration";
  let db: ReturnType<typeof openPostgres> | undefined;
  try {
    const settings = hostedConfig();
    stage = "database_connection";
    db = openPostgres(settings.database);
    await db.query("SELECT 1");
    stage = "schema_verification";
    await verifyMigrations(db);
    stage = "runtime_permissions";
    await verifyRuntimeRole(db);
    stage = "synthetic_workspace";
    await verifySyntheticWorkspace(db);
    attachDatabasePool(db.pool);
    return requestHandler(db, settings.app);
  } catch {
    await db?.close();
    throw new StartupFailure(stage);
  }
}
/** A warm instance shares a bounded pool, never schema creation or a disk database. */
export async function hostedHandler(req: IncomingMessage, res: ServerResponse) {
  let handler: RequestListener;
  const pending = (ready ??= initialize());
  try {
    handler = await pending;
  } catch (error) {
    if (ready === pending) ready = undefined;
    unavailable(req, res, error instanceof StartupFailure ? error.stage : "initialization");
    return;
  }
  return handler(req, res);
}
