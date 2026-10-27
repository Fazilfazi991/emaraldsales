/** Owner-approved operator command; NEVER run until infrastructure and exact batch are approved. */
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { passwordMatches } from "../src/auth.js";
import { verifyMigrations } from "../src/database.js";
import { pilotConfig, verifyPilotWorkspace } from "../src/pilot-hosted.js";
import { openPostgres, verifyRuntimeRole } from "../src/postgres.js";
import { importReviewedWorkbooks, preparePilotWorkbooks, bindPilotOwners, reviewIssueKey } from "../src/pilot-workbooks.js";

const approvalSchema=z.object({
  sourceHash:z.string().regex(/^[a-f0-9]{64}$/), customers:z.number().int().nonnegative(), leads:z.number().int().nonnegative(),
  owners:z.record(z.string(),z.string().uuid()), unassignedRows:z.array(z.number().int().min(2)),
  reviewedIssues:z.array(z.string()), acceptedBlankCells:z.array(z.string()),
}).strict();
async function main() {
  if(process.env.CRM_PILOT_IMPORT_APPROVAL!=="approved-reviewed-batch") throw new Error("approval missing");
  const settings=pilotConfig(process.env);
  const [customerPath,leadPath,manifestPath]=process.argv.slice(2);
  const email=process.env.CRM_IMPORT_EMAIL, password=process.env.CRM_IMPORT_PASSWORD;
  if(!customerPath || !leadPath || !manifestPath || !email || !password) throw new Error("operator input missing");
  const approval=approvalSchema.parse(JSON.parse(await readFile(manifestPath,"utf8")));
  if(process.env.CRM_APPROVED_SOURCE_HASH!==approval.sourceHash) throw new Error("batch approval mismatch");
  const [customerBytes,leadBytes]=await Promise.all([readFile(customerPath),readFile(leadPath)]);
  const preview=await preparePilotWorkbooks(customerBytes,leadBytes);
  bindPilotOwners(preview,approval);
  if(preview.rows.filter(r=>r.kind==="customer").length!==approval.customers || preview.rows.filter(r=>r.kind==="lead").length!==approval.leads) throw new Error("batch count mismatch");
  if(JSON.stringify(preview.issues.map(reviewIssueKey).sort())!==JSON.stringify([...approval.reviewedIssues].sort())) throw new Error("review mismatch");
  if(JSON.stringify(preview.issues.filter(i=>i.code==="formula_unusable").map(reviewIssueKey).sort())!==JSON.stringify([...approval.acceptedBlankCells].sort())) throw new Error("blank-field decision missing");
  if(preview.issues.some(i=>i.code==="missing_name")) throw new Error("missing source name");
  const db=openPostgres(settings.database);
  try {
    // A separate, short-lived role must be used; the web runtime intentionally has
    // no import privileges. Never pass this credential to the hosted application.
    const role=(await db.query<{name:string}>("SELECT current_user AS name")).rows[0];
    if(role?.name!=="emerald_importer") throw new Error("Dedicated import role required");
    await verifyMigrations(db); await verifyRuntimeRole(db); await verifyPilotWorkspace(db,settings.organizationId);
    const account=(await db.query<{id:string;name:string;role:"manager"|"admin";password_hash:string}>("SELECT u.id,u.name,u.password_hash,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.email=$1 AND u.active AND m.organization_id=$2 AND m.role IN ('manager','admin')",[email.toLowerCase(),settings.organizationId])).rows[0];
    if(!account || !await passwordMatches(password,account.password_hash)) throw new Error("operator authentication failed");
    const result=await importReviewedWorkbooks(db,{id:account.id,name:account.name,role:account.role,organizationId:settings.organizationId},customerBytes,leadBytes,approval);
    console.log(`Import ${result.replay?"already recorded":"committed"}: ${result.customers} customers, ${result.leads} enquiries.`);
  } finally {await db.close();}
}
try {await main();} catch {console.error("Import not confirmed. Check the private approval, operator credentials and deployment readiness with the administrator."); process.exitCode=1;}
