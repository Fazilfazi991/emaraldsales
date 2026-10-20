import { mkdir, writeFile } from "node:fs/promises";
import { openDatabase } from "../src/database.js";
import { config } from "../src/config.js";
const label=process.argv[2];
if(!["before","after"].includes(label))throw new Error("Use phase2-inspect.ts before|after with the server stopped.");
const db=await openDatabase(config().dataDir);
try {
  const counts=(await db.query(`SELECT (SELECT count(*)::int FROM shops) AS shops,(SELECT count(*)::int FROM visits) AS visits,(SELECT count(*)::int FROM followups) AS followups,(SELECT count(*)::int FROM users) AS users,(SELECT count(*)::int FROM audit_events) AS audit_events,(SELECT count(*)::int FROM duty_sessions) AS duty_sessions`)).rows[0];
  const migrations=(await db.query("SELECT name,sha256 FROM schema_migrations ORDER BY name")).rows;
  const indexes=(await db.query<{indexname:string}>("SELECT indexname FROM pg_indexes WHERE tablename IN ('visits','shops') ORDER BY indexname")).rows.map(r=>r.indexname);
  const recordFingerprint=(await db.query(`SELECT md5(COALESCE(string_agg(id::text||':'||organization_id::text||':'||assigned_executive_id::text||':'||created_by::text,'|' ORDER BY id),'')) AS shops FROM shops`)).rows[0];
  await mkdir("evidence/phase2",{recursive:true});
  await writeFile(`evidence/phase2/migration-${label}.json`,JSON.stringify({executedAt:new Date().toISOString(),counts,migrations,indexes,recordFingerprint},null,2));
  console.log(`Recorded ${label} migration inventory and record counts without credentials.`);
}finally{await db.close();}
