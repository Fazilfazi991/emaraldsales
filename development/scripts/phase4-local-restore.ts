import {mkdtemp,cp,readdir,readFile,writeFile,mkdir,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve,dirname,basename,relative} from "node:path";
import {createHash,randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
import {openDatabase,migrate,type Database} from "../src/database.js";
import {seedDemonstration} from "../src/demo-fixtures.js";
import {syntheticId} from "../src/fixtures.js";
import {CRM} from "../src/service.js";
import {login} from "../src/auth.js";
import {businessDay,type Actor} from "../src/domain.js";

const root=await mkdtemp(join(tmpdir(),"emerald-phase4-restore-"));
assert.equal(dirname(resolve(root)).toLowerCase(),resolve(tmpdir()).toLowerCase());
assert.ok(basename(root).startsWith("emerald-phase4-restore-"));
const started=Date.now(),out="evidence/phase4/restore";
await mkdir(out,{recursive:true});
const source=join(root,"source"),backup=join(root,"cold-backup"),restored=join(root,"restored");
let db:Database|undefined;
const hash=(bytes:Buffer|string)=>createHash("sha256").update(bytes).digest("hex");
async function inventory(db:Database){
  const result:Record<string,{rows:number;sha256:string}>={};
  for(const table of ["organizations","users","memberships","shops","visits","followups","duty_sessions","rest_intervals","audit_events","idempotency","sessions","schema_migrations","login_attempts","import_batches"]){
    const rows=(await db.query(`SELECT * FROM ${table} ORDER BY 1,2`)).rows;
    result[table]={rows:rows.length,sha256:hash(JSON.stringify(rows))};
  }
  const constraints=(await db.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")).rows;
  return{tables:result,indexes:constraints};
}
async function manifest(path:string){
  const entries:Record<string,string>={};
  async function walk(folder:string){for(const entry of await readdir(folder,{withFileTypes:true})){const full=join(folder,entry.name);if(entry.isDirectory())await walk(full);else if(entry.isFile())entries[relative(path,full).replaceAll("\\","/")]=hash(await readFile(full));else throw Error("Unexpected non-file in temporary database snapshot");}}
  await walk(path);return entries;
}
try{
  db=await openDatabase(source);await migrate(db);const fixture=await seedDemonstration(db);
  const account=fixture.accounts.find(a=>a.email==="ahmed@local.invalid")!;
  const actor:Actor={id:account.id,name:account.name,role:account.role,organizationId:fixture.organizationId};
  const crm=new CRM(db,{visitPolicy:"approved-v2",dutyPolicy:"approved-v1"});
  const session=await crm.duty(actor,randomUUID(),"start",{expectedSessionId:null}) as {sessionId:string};
  for(const action of ["rest","return","end"] as const)await crm.duty(actor,randomUUID(),action,{expectedSessionId:session.sessionId});
  const checked=await crm.checkin(actor,randomUUID(),{shopId:syntheticId("shop-1"),location:{availability:"not_requested"}}) as {visit:{id:string}};
  const saved=await crm.checkout(actor,randomUUID(),checked.visit.id,{outcome:"Regular Visit",notes:"Synthetic restore drill",orderStatus:"No Order",orderNote:"",orderValue:null,followUpDate:businessDay(new Date())}) as {followup:{id:string;version:number}};
  await crm.updateFollowup(actor,randomUUID(),saved.followup.id,{action:"complete",version:saved.followup.version,reason:"Synthetic restore verification"});
  await login(db,account.email,account.password,"127.0.0.1");
  const before=await inventory(db);assert.equal(before.tables.shops.rows,700);
  for(const table of ["visits","followups","duty_sessions","rest_intervals","audit_events","idempotency","sessions"])assert.ok(before.tables[table].rows>0,`${table} must contain representative recovery data`);
  await db.close();db=undefined;
  // Cold copy only: the writer is closed and the process lock has been released.
  await cp(source,backup,{recursive:true,errorOnExist:true,force:false});
  const backupManifest=await manifest(backup),restoreStart=Date.now();
  await cp(backup,restored,{recursive:true,errorOnExist:true,force:false});
  assert.deepEqual(await manifest(restored),backupManifest,"Restored files must match the cold snapshot before opening");
  db=await openDatabase(restored);await migrate(db);const after=await inventory(db);
  assert.deepEqual(after,before,"All listed rows and indexes must survive the independent restored copy");
  await db.close();db=undefined;
  db=await openDatabase(source);assert.deepEqual(await inventory(db),before,"Original temporary source is unchanged");
  await db.close();db=undefined;
  await writeFile(`${out}/result.json`,JSON.stringify({status:"passed",executedAt:new Date().toISOString(),sourceCommit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),scope:"Isolated synthetic PGlite cold-copy backup and independent restore; not a hosted PostgreSQL/PITR or operational demo backup",sourceStoppedBeforeCopy:true,shopCount:700,verifiedFileCount:Object.keys(backupManifest).length,inventory:after,restoredFileHashes:backupManifest,restoreAndVerificationMs:Date.now()-restoreStart,totalDrillMs:Date.now()-started,credentialsOrRowsExported:false,cleanup:"Temporary databases removed in finally"},null,2));
  console.log("Isolated local cold-copy restore passed: 700 shops, table digests, migrations and indexes match. Hosted recovery remains untested.");
}finally{
  await db?.close();
  assert.equal(dirname(resolve(root)).toLowerCase(),resolve(tmpdir()).toLowerCase());assert.ok(basename(root).startsWith("emerald-phase4-restore-"));
  await rm(root,{recursive:true,force:true});
}
