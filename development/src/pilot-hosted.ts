/** Separately gated pilot handler selected by the Vercel entrypoint only for the approved pilot stage. */
import type { IncomingMessage, ServerResponse, RequestListener } from "node:http";
import { attachDatabasePool } from "@vercel/functions";
import { z } from "zod";
import type { Config } from "./config.js";
import { verifyMigrations, type Queryable } from "./database.js";
import { openPostgres, postgresPoolOptions, verifyRuntimeRole, type PostgresSettings } from "./postgres.js";
import { requestHandler } from "./server.js";
import { unavailable } from "./unavailable.js";

export function pilotConfig(env: NodeJS.ProcessEnv) {
  if (env.VERCEL!=="1" || env.NODE_ENV!=="production" || env.CRM_PILOT_STAGE!=="approved-real-data-pilot") throw new Error("Pilot approval is missing");
  const organizationId=z.string().uuid().parse(env.CRM_PILOT_ORGANIZATION_ID);
  let url:URL; try {url=new URL(env.APP_ORIGIN ?? "");} catch {throw new Error("Pilot HTTPS origin is required");}
  if (url.protocol!=="https:" || url.origin!==env.APP_ORIGIN || url.username || url.password || url.port || ["localhost","127.0.0.1","[::1]"].includes(url.hostname)) throw new Error("Pilot HTTPS origin must be exact");
  if (env.VISIT_POLICY!=="approved-v2" || env.DUTY_POLICY!=="approved-v1") throw new Error("Pilot operational policies are required");
  const database:PostgresSettings={connectionString:env.DATABASE_URL ?? "",ca:env.DATABASE_SSL_CA,max:3};
  postgresPoolOptions(database);
  const app:Config={host:"127.0.0.1",port:0,origin:url.origin,dataDir:"",secure:true,visitPolicy:env.VISIT_POLICY,dutyPolicy:env.DUTY_POLICY,trustedProxy:"vercel"};
  return {app,database,organizationId};
}
export async function verifyPilotWorkspace(db:Queryable, organizationId:string) {
  const orgs=(await db.query<{id:string;name:string}>("SELECT id,name FROM organizations")).rows;
  if (orgs.length!==1 || orgs[0].id!==organizationId || orgs[0].name==="Emerald Interlink · Synthetic review workspace") throw new Error("Pilot requires its own approved workspace");
  const synthetic=(await db.query<{n:number}>("SELECT count(*)::int AS n FROM shops WHERE synthetic=true")).rows[0];
  if (!synthetic || synthetic.n!==0) throw new Error("Synthetic shops are not allowed in the pilot workspace");
}
let ready:Promise<RequestListener>|undefined;
export async function pilotHostedHandler(req:IncomingMessage,res:ServerResponse) {
  const pending=(ready ??= (async()=>{
    const settings=pilotConfig(process.env); const db=openPostgres(settings.database);
    try { await db.query("SELECT 1"); await verifyMigrations(db); await verifyRuntimeRole(db); await verifyPilotWorkspace(db,settings.organizationId); attachDatabasePool(db.pool); return requestHandler(db,settings.app); }
    catch { await db.close(); throw new Error("Pilot initialization failed"); }
  })());
  try {return (await pending)(req,res);} catch {if(ready===pending) ready=undefined; return unavailable(req,res,"pilot_initialization");}
}
