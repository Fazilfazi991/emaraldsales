import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate, type Queryable, type Database } from "../src/database.js";
import { seedSynthetic, syntheticId } from "../src/fixtures.js";
import { createAccount } from "../src/auth.js";
import { application } from "../src/server.js";
import { CRM } from "../src/service.js";
import { Fault, type Actor } from "../src/domain.js";
import type { Config } from "../src/config.js";

test("Phase 2 backend: management changes, independent follow-ups and rollback", async (t) => {
  const db = await openDatabase();
  await migrate(db);
  const fixture = await seedSynthetic(db, 36);
  const settings: Config = { host: "127.0.0.1", port: 0, origin: "http://127.0.0.1", dataDir: "", secure: false, visitPolicy: "approved-v2", dutyPolicy: "approved-v1" };
  // Throw inside the real transaction after data changes, before the audit write.
  // This models a database write failure without a production fault injection endpoint.
  let failAudit = false;
  const wrapped: Database = {
    query: db.query,
    close: async () => {},
    transaction: (work) => db.transaction((tx) => work({
      query: ((sql: string, args?: unknown[]) => {
        if (failAudit && sql.startsWith("INSERT INTO audit_events")) {
          failAudit = false;
          throw new Error("Synthetic database write failure");
        }
        return tx.query(sql, args);
      }) as Queryable["query"],
    })),
  };
  const server = application(wrapped, settings);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  settings.origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  type Auth = { actor: Actor; cookie: string; csrf: string };
  async function request(path: string, auth?: Auth, body?: unknown, key = randomUUID(), headers = {}) {
    const response = await fetch(`${settings.origin}/api${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Origin: settings.origin, ...(auth ? { Cookie: auth.cookie, "X-CSRF-Token": auth.csrf } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json", "Idempotency-Key": key }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json(), cookie: response.headers.get("set-cookie") };
  }
  async function login(slug: string): Promise<Auth> {
    const account = fixture.accounts.find((a) => a.email === `${slug}@local.invalid`)!;
    const response = await request("/login", undefined, { email: account.email, password: account.password });
    assert.equal(response.status, 200);
    return { actor: { id: account.id, organizationId: fixture.organizationId, role: account.role, name: account.name }, cookie: response.cookie!.split(";")[0], csrf: response.data.csrf };
  }
  const exec = await login("ahmed"), second = await login("naseer"), manager = await login("manager"), admin = await login("admin");
  const shopId = syntheticId("shop-1");
  const profile = async () => (await request(`/shops/${shopId}`, manager)).data;
  const checkoutBody = { outcome: "Regular Visit", notes: "Discussed stock availability.", orderStatus: "No Order", followUpDate: null };
  let visitId = "", followupId = "", foreignExec = "", foreignShop = "", foreignOrg = "", inactiveExec = "";
  try {
    await t.test("migration retains performer uniqueness and historical approval cannot activate visits", async () => {
      const indexes = (await db.query<any>("SELECT indexname FROM pg_indexes WHERE tablename='visits'")).rows.map((r: any) => r.indexname);
      assert.ok(indexes.includes("one_open_visit_per_executive"));
      assert.ok(!indexes.includes("one_open_visit_per_shop"));
      assert.equal((await profile()).shop.version, 1);
      for (const policy of ["pending", "approved-v1"]) {
        const gated = new CRM(db, { ...settings, visitPolicy: policy });
        await assert.rejects(() => gated.checkin(exec.actor, randomUUID(), { shopId, location: { availability: "not_requested" } }), (error: unknown) => error instanceof Fault && error.code === "POLICY_PENDING");
        assert.throws(() => gated.createFollowup(exec.actor, randomUUID(), { visitId: randomUUID(), dueDate: "2099-01-01" }), (error: unknown) => error instanceof Fault && error.code === "POLICY_PENDING");
      }
      assert.equal((await db.query<any>("SELECT count(*)::int AS n FROM visits WHERE lifecycle='open' AND visitor_id=$1", [exec.actor.id])).rows[0].n, 0);
    });
    await t.test("shop edits require management, CSRF, reason, strict fields and current version", async () => {
      const shop = (await profile()).shop;
      const body = { version: shop.version, name: "Updated Synthetic Shop", contact: shop.contact, phone: shop.phone, area: shop.area, location: shop.location, notes: "Verified contact details.", reason: "Owner confirmed the contact details." };
      assert.equal((await request(`/shops/${shopId}/update`, undefined, body)).status, 401);
      assert.equal((await request(`/shops/${shopId}/update`, exec, body)).status, 403);
      assert.equal((await request(`/shops/${shopId}/update`, manager, body, randomUUID(), { "X-CSRF-Token": "wrong" })).status, 403);
      assert.equal((await request(`/shops/${shopId}/update`, manager, { ...body, reason: " " })).status, 422);
      assert.equal((await request(`/shops/${shopId}/update`, manager, { ...body, status: "Customer" })).status, 422);
      const key = randomUUID();
      const results = await Promise.all([request(`/shops/${shopId}/update`, manager, body, key), request(`/shops/${shopId}/update`, manager, body, key)]);
      assert.deepEqual(results.map((r) => r.status), [200, 200]);
      assert.deepEqual(results[0].data, results[1].data);
      assert.equal(results[0].data.shop.version, shop.version + 1);
      assert.equal((await request(`/shops/${shopId}/update`, admin, body)).status, 409);
      assert.equal((await request(`/shops/${shopId}/update`, manager, { ...body, name: "Changed payload" }, key)).data.error.code, "KEY_REUSED");
    });
    await t.test("separate same-shop visits retain performer attribution and independently created follow-ups", async () => {
      const before = await profile();
      const checked = await Promise.all([exec, second].map((auth) => request("/checkin", auth, { shopId, location: { availability: "not_requested" } })));
      assert.deepEqual(checked.map((r) => r.status), [200, 200]);
      visitId = checked[0].data.visit.id;
      assert.equal(checked[0].data.visit.visitor_id, exec.actor.id);
      assert.equal(checked[1].data.visit.visitor_id, second.actor.id);
      assert.equal((await request("/followups", exec, { visitId, dueDate: "2099-01-01" })).data.error.code, "VISIT_OPEN");
      assert.equal((await request(`/visits/${visitId}/checkout`, manager, checkoutBody)).status, 403);
      for (const [i, auth] of [exec, second].entries())
        assert.equal((await request(`/visits/${checked[i].data.visit.id}/checkout`, auth, checkoutBody)).status, 200);
      assert.equal((await request("/followups", second, { visitId, dueDate: "2099-01-01" })).status, 403);
      assert.equal((await request("/followups", manager, { visitId, dueDate: "2099-01-01" })).status, 403);
      assert.equal((await request("/followups", exec, { visitId, dueDate: "2020-01-01" })).status, 422);
      assert.equal((await request("/followups", exec, { visitId, dueDate: "2099-01-01", ownerId: second.actor.id })).status, 422);
      const key = randomUUID();
      const replies = await Promise.all([request("/followups", exec, { visitId, dueDate: "2099-01-01" }, key), request("/followups", exec, { visitId, dueDate: "2099-01-01" }, key)]);
      assert.deepEqual(replies.map((r) => r.status), [200, 200]);
      assert.equal(replies[0].data.followup.id, replies[1].data.followup.id);
      followupId = replies[0].data.followup.id;
      const after = await profile();
      assert.equal(after.shop.assigned_executive_id, before.shop.assigned_executive_id);
      assert.equal(after.shop.version, before.shop.version);
      assert.equal(after.followups.length, before.followups.length + 1);
      for (const f of before.followups) assert.deepEqual(after.followups.find((row: any) => row.id === f.id), f);
    });
    await t.test("explicit transfer is audited, versioned and idempotent without changing visits or follow-ups", async () => {
      const before = await profile();
      const target = before.shop.assigned_executive_id === second.actor.id ? exec.actor.id : second.actor.id;
      const body = { version: before.shop.version, assignedExecutiveId: target, reason: "Approved route reassignment." };
      assert.equal((await request(`/shops/${shopId}/transfer`, exec, body)).status, 403);
      assert.equal((await request(`/shops/${shopId}/transfer`, manager, { ...body, reason: "" })).status, 422);
      const key = randomUUID();
      const a = await request(`/shops/${shopId}/transfer`, manager, body, key), b = await request(`/shops/${shopId}/transfer`, manager, body, key);
      assert.equal(a.status, 200);
      assert.deepEqual(a.data, b.data);
      assert.equal(a.data.shop.assigned_executive_id, target);
      assert.equal((await request(`/shops/${shopId}/transfer`, admin, body)).status, 409);
      const after = await profile();
      assert.deepEqual(after.visits, before.visits);
      assert.deepEqual(after.followups, before.followups);
      const event = (await request(`/shops/${shopId}/audit`, exec)).data.rows.find((r: any) => r.action === "shop.transfer");
      assert.equal(event.actor_id, manager.actor.id);
      assert.equal(event.actor_name, manager.actor.name);
      assert.equal(event.details.reason, body.reason);
      assert.equal(event.details.before.assignedExecutiveId, before.shop.assigned_executive_id);
    });
    await t.test("assignment targets must be active same-organization executives", async () => {
      foreignOrg = randomUUID(); foreignShop = randomUUID();
      await db.transaction(async (tx) => {
        await tx.query("INSERT INTO organizations(id,name) VALUES($1,'Separate synthetic organization')", [foreignOrg]);
        foreignExec = await createAccount(tx, foreignOrg, "foreign@local.invalid", "Foreign Executive", "executive", `Synthetic-password-${randomUUID()}`);
        inactiveExec = await createAccount(tx, fixture.organizationId, "inactive@local.invalid", "Inactive Executive", "executive", `Synthetic-password-${randomUUID()}`);
        await tx.query("UPDATE users SET active=false WHERE id=$1", [inactiveExec]);
        await tx.query("INSERT INTO shops(id,organization_id,name,area,status,assigned_executive_id,created_by) VALUES($1,$2,'Foreign Shop','Foreign Area','Customer',$3,$3)", [foreignShop, foreignOrg, foreignExec]);
      });
      const before = await profile();
      for (const ownerId of [manager.actor.id, foreignExec, inactiveExec, randomUUID()]) {
        const assignment = await request(`/followups/${followupId}/assign`, manager, { version: 1, ownerId, reason: "Test invalid target." });
        assert.equal(assignment.status, 422);
        assert.equal(assignment.data.error.code, "INVALID_EXECUTIVE");
        assert.equal((await request(`/shops/${shopId}/transfer`, manager, { version: before.shop.version, assignedExecutiveId: ownerId, reason: "Test invalid target." })).status, 422);
      }
      assert.equal((await request(`/shops/${foreignShop}/audit`, manager)).status, 404);
      assert.equal((await request(`/shops/${foreignShop}/transfer`, manager, { version: 1, assignedExecutiveId: exec.actor.id, reason: "Cross organization attempt." })).status, 404);
      assert.equal((await request(`/followups/${followupId}/assign`, exec, { version: 1, ownerId: second.actor.id, reason: "Unauthorized." })).status, 403);
      assert.equal((await request(`/followups/${followupId}/assign`, manager, { version: 1, ownerId: second.actor.id, reason: " " })).status, 422);
    });
    await t.test("concurrent management assignment has one winner; old owner cannot change reassigned follow-up", async () => {
      const body = { version: 1, ownerId: second.actor.id, reason: "Approved cover during leave." };
      const replies = await Promise.all([request(`/followups/${followupId}/assign`, manager, body), request(`/followups/${followupId}/assign`, admin, body)]);
      assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
      const saved = replies.find((r) => r.status === 200)!.data.followup;
      assert.equal(saved.owner_id, second.actor.id);
      assert.equal(saved.version, 2);
      assert.equal(saved.visit_id, visitId);
      assert.equal((await request(`/followups/${followupId}`, exec, { action: "complete", reason: "Former owner attempt", version: 2 })).status, 403);
      assert.equal((await request(`/followups/${followupId}`, manager, { action: "complete", reason: "Manager attempt", version: 2 })).status, 403);
      assert.equal((await request(`/followups/${followupId}`, second, { action: "reschedule", reason: "Customer requested later", version: 2, dueDate: "2099-02-01" })).status, 200);
      assert.equal((await request(`/followups/${followupId}/assign`, manager, { ...body, version: 2, ownerId: exec.actor.id })).status, 409);
      assert.equal((await request(`/followups/${followupId}`, second, { action: "complete", reason: "Called customer", version: 3 })).status, 200);
      assert.equal((await request(`/followups/${followupId}/assign`, manager, { ...body, version: 4, ownerId: exec.actor.id })).status, 409);
    });
    await t.test("database failures roll back checkout, transfer and assignment, then same-key retry succeeds", async () => {
      const before = await profile();
      const checkin = await request("/checkin", exec, { shopId, location: { availability: "denied" } });
      assert.equal(checkin.status, 200);
      const id = checkin.data.visit.id, checkoutKey = randomUUID();
      failAudit = true;
      const failed = await request(`/visits/${id}/checkout`, exec, { ...checkoutBody, followUpDate: "2099-03-01" }, checkoutKey);
      assert.equal(failed.status, 500);
      let current = await profile();
      assert.equal(current.visits.find((v: any) => v.id === id).lifecycle, "open");
      assert.equal(current.followups.length, before.followups.length);
      assert.equal((await db.query<any>("SELECT count(*)::int AS n FROM idempotency WHERE actor_id=$1 AND key=$2", [exec.actor.id, checkoutKey])).rows[0].n, 0);
      const completed = await request(`/visits/${id}/checkout`, exec, { ...checkoutBody, followUpDate: "2099-03-01" }, checkoutKey);
      assert.equal(completed.status, 200);
      current = await profile();
      const transfer = { version: current.shop.version, assignedExecutiveId: current.shop.assigned_executive_id === exec.actor.id ? second.actor.id : exec.actor.id, reason: "Route coverage" }, transferKey = randomUUID();
      failAudit = true;
      assert.equal((await request(`/shops/${shopId}/transfer`, manager, transfer, transferKey)).status, 500);
      assert.deepEqual((await profile()).shop, current.shop);
      assert.equal((await request(`/shops/${shopId}/transfer`, manager, transfer, transferKey)).status, 200);
      const followup = completed.data.followup, assign = { version: 1, ownerId: second.actor.id, reason: "Route coverage" }, assignKey = randomUUID();
      failAudit = true;
      assert.equal((await request(`/followups/${followup.id}/assign`, manager, assign, assignKey)).status, 500);
      assert.equal((await profile()).followups.find((f: any) => f.id === followup.id).owner_id, exec.actor.id);
      assert.equal((await request(`/followups/${followup.id}/assign`, manager, assign, assignKey)).status, 200);
    });
    await t.test("executive dashboard scopes before row limits and manager dashboard retains team view", async () => {
      // More than a full shared page of visits must not hide an executive's own day.
      await db.transaction(async (tx) => {
        for (let i = 0; i < 105; i++) {
          const id = randomUUID();
          await tx.query(`INSERT INTO visits(id,organization_id,shop_id,visitor_id,created_by,checked_in_at,checked_out_at,lifecycle,outcome,notes,location) VALUES($1,$2,$3,$4,$4,now(),now(),'completed','Regular Visit','Synthetic page pressure','{"availability":"not_requested"}')`, [id, fixture.organizationId, shopId, second.actor.id]);
          await tx.query("INSERT INTO followups(id,organization_id,shop_id,visit_id,owner_id,created_by,due_date) VALUES($1,$2,$3,$4,$5,$5,(now() AT TIME ZONE 'Asia/Dubai')::date)", [randomUUID(), fixture.organizationId, shopId, id, second.actor.id]);
        }
        await tx.query("INSERT INTO followups(id,organization_id,shop_id,visit_id,owner_id,created_by,due_date) VALUES($1,$2,$3,$4,$5,$5,(now() AT TIME ZONE 'Asia/Dubai')::date)", [randomUUID(), fixture.organizationId, shopId, visitId, exec.actor.id]);
      });
      const mine = (await request("/dashboard", exec)).data, team = (await request("/dashboard", manager)).data;
      assert.ok(mine.followups.some((f: any) => f.visit_id === visitId));
      assert.ok(mine.followups.every((f: any) => f.owner_id === exec.actor.id));
      assert.ok(mine.today.rows.every((v: any) => v.visitor_id === exec.actor.id));
      assert.ok(mine.today.rows.some((v: any) => v.id === visitId));
      assert.ok(team.metrics.today > mine.metrics.today);
      assert.ok(team.metrics.pending > mine.metrics.pending);
    });
    await t.test("audit is attributable, paginated, organization scoped and append-only", async () => {
      const result = await request(`/shops/${shopId}/audit`, second);
      assert.equal(result.status, 200);
      assert.equal(result.data.pageSize, 40);
      assert.ok(result.data.rows.every((r: any) => r.organization_id === fixture.organizationId && r.actor_name && r.actor_id));
      for (const action of ["shop.update", "shop.transfer", "followup.assign", "followup.reschedule", "followup.complete", "visit.checkout"])
        assert.ok(result.data.rows.some((r: any) => r.action === action), action);
      assert.equal((await request(`/shops/${shopId}/audit?page=-1`, manager)).status, 422);
      assert.equal((await request(`/shops/${foreignShop}/audit`, manager)).status, 404);
      await assert.rejects(() => db.query("DELETE FROM audit_events WHERE organization_id=$1", [fixture.organizationId]), /append-only/);
    });
    await t.test("changed membership is checked inside the mutation transaction", async () => {
      const crm = new CRM(db, settings);
      await db.query("UPDATE memberships SET role='executive' WHERE user_id=$1", [manager.actor.id]);
      const shop = (await profile()).shop;
      await assert.rejects(() => crm.transferShop(manager.actor, randomUUID(), shopId, { version: shop.version, assignedExecutiveId: exec.actor.id, reason: "Stale role attempt" }), (error: unknown) => error instanceof Fault && error.status === 403);
    });
  } finally {
    await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    await db.close();
  }
});
