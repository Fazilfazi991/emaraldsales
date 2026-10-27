import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate } from "../src/database.js";
import { seedSynthetic } from "../src/fixtures.js";
import { CRM } from "../src/service.js";
import { Fault, type Actor } from "../src/domain.js";

test("manager conversion preserves history and separates enquiry and customer lists", async () => {
  const db = await openDatabase();
  try {
    await migrate(db);
    const fixture = await seedSynthetic(db, 36);
    const makeActor = (role: Actor["role"]): Actor => {
      const a = fixture.accounts.find((account) => account.role === role)!;
      return { id: a.id, name: a.name, role, organizationId: fixture.organizationId };
    };
    const manager = makeActor("manager"), executive = makeActor("executive");
    const crm = new CRM(db, { visitPolicy: "approved-v2", dutyPolicy: "approved-v1" });
    const leads = await crm.listShops(manager, new URLSearchParams("kind=lead"));
    const lead = leads.rows.find((item) => item.assigned_executive_id === executive.id)!;
    assert.ok(lead && lead.status !== "Customer");
    const before = await crm.profile(manager, lead.id);
    const other = fixture.accounts.find(a => a.role === "executive" && a.id !== executive.id)!;
    const otherActor: Actor = {id:other.id,name:other.name,role:other.role,organizationId:fixture.organizationId};
    await assert.rejects(() => crm.updateLeadStatus(otherActor, randomUUID(), lead.id, {version:lead.version,status:"Contacted"}), (e: unknown) => e instanceof Fault && e.status === 403);
    const newStatus = lead.status === "Interested" ? "Contacted" : "Interested";
    await crm.updateLeadStatus(executive, randomUUID(), lead.id, {version:lead.version,status:newStatus});
    lead.version++;
    lead.status=newStatus;
    assert.throws(() => crm.convertLead(executive, randomUUID(), lead.id, { version: lead.version }), (e: unknown) => e instanceof Fault && e.status === 403);
    const key = randomUUID();
    const [a, b] = await Promise.all([
      crm.convertLead(manager, key, lead.id, { version: lead.version }),
      crm.convertLead(manager, key, lead.id, { version: lead.version }),
    ]);
    assert.deepEqual(a, b);
    const after = await crm.profile(manager, lead.id);
    assert.equal(after.shop.status, "Customer");
    assert.deepEqual(after.visits, before.visits);
    assert.deepEqual(after.followups, before.followups);
    assert.equal(after.shop.assigned_executive_id, before.shop.assigned_executive_id);
    const customers = await crm.listShops(manager, new URLSearchParams("kind=customer"));
    assert.ok(customers.rows.some((shop) => shop.id === lead.id));
    assert.equal((await crm.listShops(manager, new URLSearchParams("kind=lead"))).total, leads.total - 1);
    await assert.rejects(() => crm.convertLead(manager, randomUUID(), lead.id, { version: lead.version }), (e: unknown) => e instanceof Fault && e.code === "STALE_RECORD");
    const events = (await db.query<{ details: object }>("SELECT details FROM audit_events WHERE entity_id=$1 AND action='lead.convert'", [lead.id])).rows;
    assert.equal(events.length, 1);
    assert.deepEqual(events[0].details, { before: { status: lead.status, version: lead.version }, after: { status: "Customer", version: lead.version + 1 } });
  } finally { await db.close(); }
});
