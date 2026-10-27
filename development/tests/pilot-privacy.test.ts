import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate } from "../src/database.js";
import { seedSynthetic, syntheticId } from "../src/fixtures.js";
import { CRM } from "../src/service.js";
import type { Actor } from "../src/domain.js";

test("audit records changed fields but excludes contact values and free-text visit details", async () => {
  const db=await openDatabase();
  try {
    await migrate(db); const f=await seedSynthetic(db,36); const a=f.accounts.find(x=>x.role==="manager")!;
    const actor:Actor={id:a.id,name:a.name,role:a.role,organizationId:f.organizationId};
    const crm=new CRM(db,{visitPolicy:"approved-v2",dutyPolicy:"approved-v1"}), id=syntheticId("shop-1");
    const shop=(await crm.profile(actor,id)).shop;
    const token="0123456789012";
    await crm.updateShop(actor,randomUUID(),id,{version:shop.version,name:shop.name,contact:shop.contact,phone:token,area:shop.area,location:shop.location,notes:token,reason:`Updated contact ${token}`});
    const row=(await db.query<{details:Record<string,any>}>("SELECT details FROM audit_events WHERE action='shop.update' AND entity_id=$1",[id])).rows[0];
    assert.ok(row.details.changedFields.includes("phone"));
    assert.ok(!JSON.stringify(row.details).includes(token));
    assert.match(row.details.reason,/redacted/);
  } finally {await db.close();}
});
