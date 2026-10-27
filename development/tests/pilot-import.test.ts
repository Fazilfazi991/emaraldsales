import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate, type Database, type Queryable } from "../src/database.js";
import { createAccount } from "../src/auth.js";
import { importPilotBatch } from "../src/pilot-import.js";
import { Fault, type Actor } from "../src/domain.js";

test("pilot import atomically preserves distinct source rows and retries safely", async () => {
  const db = await openDatabase();
  try {
    await migrate(db);
    const org = randomUUID();
    await db.query("INSERT INTO organizations(id,name) VALUES($1,$2)", [org,"Synthetic empty pilot test"]);
    const managerId = await createAccount(db, org, "manager@synthetic.invalid", "Synthetic manager", "manager", "test-only-password-12345");
    const execId = await createAccount(db, org, "exec@synthetic.invalid", "Synthetic executive", "executive", "test-only-password-12345");
    const manager: Actor = { id: managerId, organizationId: org, role: "manager", name: "Synthetic manager" };
    const executive: Actor = { id: execId, organizationId: org, role: "executive", name: "Synthetic executive" };
    const row = { row: 2, name: "Fictional duplicate", contact: "", phone: "0012345", phoneType: "text", whatsapp: "", whatsappType: "empty", area: "", emirate: "", country: "", zohoId: "", ownerId: execId };
    const batch = { sourceHash: "a".repeat(64), rows: [{...row,kind:"customer"}, {...row,kind:"lead",ownerId:null}] };
    await assert.rejects(() => importPilotBatch(db, executive, batch), (e: unknown) => e instanceof Fault && e.status === 403);
    let fail = true;
    const faulty: Database = { query: db.query, close: async () => {}, transaction: (work) => db.transaction((tx) => work({ query: ((sql: string, args?: unknown[]) => {
      if (fail && sql.startsWith("INSERT INTO import_source_rows")) { fail = false; throw new Error("synthetic failure"); }
      return tx.query(sql, args);
    }) as Queryable["query"] })) };
    await assert.rejects(() => importPilotBatch(faulty, manager, batch), /synthetic failure/);
    assert.equal((await db.query<{n: number}>("SELECT count(*)::int AS n FROM shops WHERE organization_id=$1",[org])).rows[0].n, 0);
    assert.equal((await db.query<{n: number}>("SELECT count(*)::int AS n FROM import_batches WHERE organization_id=$1",[org])).rows[0].n, 0);
    const [one,two] = await Promise.all([importPilotBatch(db, manager, batch), importPilotBatch(db, manager, batch)]);
    assert.equal(one.batchId,two.batchId);
    assert.deepEqual([one.replay,two.replay].sort(),[false,true]);
    assert.equal(one.customers,1); assert.equal(one.leads,1);
    const shops = (await db.query<{status: string; phone: string; assigned_executive_id: string | null}>("SELECT status,phone,assigned_executive_id FROM shops WHERE organization_id=$1 ORDER BY status",[org])).rows;
    assert.equal(shops.length,2); assert.ok(shops.every((s) => s.phone === "0012345"));
    assert.equal(shops.find((s) => s.status === "New Lead")?.assigned_executive_id,null);
    await assert.rejects(() => importPilotBatch(db, manager, {...batch,rows:[batch.rows[0]]}), (e: unknown) => e instanceof Fault && e.code === "IMPORT_MISMATCH");
    await assert.rejects(() => importPilotBatch(db, manager, {...batch,sourceHash:"b".repeat(64)}), (e: unknown) => e instanceof Fault && e.code === "WORKSPACE_NOT_EMPTY");
  } finally { await db.close(); }
});
