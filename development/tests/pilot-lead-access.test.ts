import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate } from "../src/database.js";
import { seedSynthetic, syntheticId } from "../src/fixtures.js";
import { CRM } from "../src/service.js";
import { Fault, type Actor } from "../src/domain.js";
import { application } from "../src/server.js";
import type { Config } from "../src/config.js";

test("executives see assigned leads and shared customers, while managers see unassigned leads", async () => {
  const db = await openDatabase();
  try {
    await migrate(db);
    const fixture = await seedSynthetic(db, 36);
    const actor = (email: string): Actor => {
      const a = fixture.accounts.find(item => item.email === email)!;
      return { id: a.id, name: a.name, role: a.role, organizationId: fixture.organizationId };
    };
    const executive = actor("ahmed@local.invalid"), other = actor("naseer@local.invalid"), manager = actor("manager@local.invalid");
    const own = syntheticId("shop-1"), theirs = syntheticId("shop-2"), unassigned = syntheticId("shop-3"), customer = syntheticId("shop-4");
    await db.query("UPDATE shops SET status='New Lead',assigned_executive_id=$2 WHERE id=$1", [own, executive.id]);
    await db.query("UPDATE shops SET status='New Lead',assigned_executive_id=$2 WHERE id=$1", [theirs, other.id]);
    await db.query("UPDATE shops SET status='New Lead',assigned_executive_id=NULL WHERE id=$1", [unassigned]);
    await db.query("UPDATE shops SET status='Customer',assigned_executive_id=$2 WHERE id=$1", [customer, other.id]);
    const crm = new CRM(db, { visitPolicy: "approved-v2", dutyPolicy: "approved-v1" });
    const list = await crm.listShops(executive, new URLSearchParams());
    const ids = new Set(list.rows.map(row => row.id));
    assert.ok(ids.has(own)); assert.ok(ids.has(customer));
    assert.ok(!ids.has(theirs)); assert.ok(!ids.has(unassigned));
    assert.equal((await crm.profile(executive, customer)).shop.id, customer);
    assert.equal((await crm.profile(executive, own)).shop.id, own);
    for (const id of [theirs, unassigned]) {
      await assert.rejects(() => crm.profile(executive, id), (e: unknown) => e instanceof Fault && e.status === 404);
      await assert.rejects(() => crm.shopAudit(executive, id, new URLSearchParams()), (e: unknown) => e instanceof Fault && e.status === 404);
      await assert.rejects(() => crm.checkin(executive, randomUUID(), {shopId:id,location:{availability:"not_requested"}}), (e: unknown) => e instanceof Fault && e.status === 404);
      assert.equal((await crm.profile(manager, id)).shop.id, id);
    }
    const dashboard = await crm.dashboard(executive);
    assert.ok(!dashboard.recent.some(row => [theirs,unassigned].includes(row.id)));
    assert.ok(!dashboard.today.rows.some(row => [theirs,unassigned].includes(row.shop_id)));
    const visits = await crm.visits(executive, new URLSearchParams());
    assert.ok(!visits.rows.some(row => [theirs,unassigned].includes(row.shop_id)));
    await crm.checkin(executive,randomUUID(),{shopId:own,location:{availability:"not_requested"}});
    const version=(await db.query<{version:number}>("SELECT version FROM shops WHERE id=$1",[own])).rows[0].version;
    await assert.rejects(()=>crm.transferShop(manager,randomUUID(),own,{version,assignedExecutiveId:other.id,reason:"Fictional reassignment"}),(e:unknown)=>e instanceof Fault&&e.code==="LEAD_HAS_WORK");
    const settings: Config = {host:"127.0.0.1",port:0,origin:"http://127.0.0.1",dataDir:"",secure:false,visitPolicy:"approved-v2",dutyPolicy:"approved-v1"};
    const server=application(db,settings);
    await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    settings.origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
    try {
      const account=fixture.accounts.find(a=>a.id===executive.id)!;
      const login=await fetch(`${settings.origin}/api/login`,{method:"POST",headers:{Origin:settings.origin,"Content-Type":"application/json"},body:JSON.stringify({email:account.email,password:account.password})});
      assert.equal(login.status,200);
      const cookie=login.headers.get("set-cookie")!.split(";")[0];
      assert.equal((await fetch(`${settings.origin}/api/shops/${theirs}`)).status,401);
      assert.equal((await fetch(`${settings.origin}/api/shops/${theirs}`,{headers:{Cookie:cookie}})).status,404);
      assert.equal((await fetch(`${settings.origin}/api/shops/${customer}`,{headers:{Cookie:cookie}})).status,200);
      const filtered=await fetch(`${settings.origin}/api/shops?person=${other.id}`,{headers:{Cookie:cookie}});
      const result=await filtered.json();
      assert.ok(!result.rows.some((row: {id:string})=>row.id===theirs));
    } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
  } finally { await db.close(); }
});
