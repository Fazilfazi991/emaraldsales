import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate, type Database } from "../src/database.js";
import { seedSynthetic, syntheticId } from "../src/fixtures.js";
import { application } from "../src/server.js";
import { createAccount } from "../src/auth.js";
import {
  businessDay,
  dayRange,
  calendarDate,
  nextDuty,
} from "../src/domain.js";
import type { Config } from "../src/config.js";

test("Emerald foundation: domain, authenticated HTTP API and disk PostgreSQL", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "emerald-foundation-"));
  const path = join(directory, "database");
  let db: Database = await openDatabase(path);
  await migrate(db);
  await migrate(db);
  const fixture = await seedSynthetic(db, 700);
  const settings: Config = {
    host: "127.0.0.1",
    port: 0,
    origin: "http://127.0.0.1",
    dataDir: path,
    secure: false,
    visitPolicy: "approved-v1",
    dutyPolicy: "approved-v1",
  };
  let server = application(db, settings);
  const listen = async () => {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    settings.origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  };
  await listen();
  type Auth = { cookie: string; csrf: string; id: string };
  async function request(
    path: string,
    auth?: Auth,
    body?: unknown,
    key?: string,
    extra: Record<string, string> = {},
  ) {
    const response = await fetch(`${settings.origin}/api${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: settings.origin,
        ...(auth ? { Cookie: auth.cookie, "X-CSRF-Token": auth.csrf } : {}),
        ...(body === undefined
          ? {}
          : {
              "Content-Type": "application/json",
              "Idempotency-Key": key ?? randomUUID(),
            }),
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    return {
      status: response.status,
      data,
      cookie: response.headers.get("set-cookie"),
    };
  }
  async function signIn(slug: string): Promise<Auth> {
    const a = fixture.accounts.find(
      (a) => a.email === `${slug}@local.invalid`,
    )!;
    const r = await request("/login", undefined, {
      email: a.email,
      password: a.password,
    });
    assert.equal(r.status, 200);
    return { id: a.id, cookie: r.cookie!.split(";")[0], csrf: r.data.csrf };
  }
  const ahmed = await signIn("ahmed"),
    naseer = await signIn("naseer"),
    manager = await signIn("manager"),
    admin = await signIn("admin");
  const shop = syntheticId("shop-1"),
    otherShop = syntheticId("shop-4");
  let visitId = "",
    followupId = "",
    dutyId = "";
  const checkout = {
    outcome: "Follow-up Required",
    notes: "Discussed cement boards. Synthetic API verification.",
    orderStatus: "Order Expected",
    orderNote: "Customer will confirm.",
    orderValue: 2500,
    followUpDate: "2099-01-02",
  };
  const endServer = () =>
    new Promise<void>((resolve, reject) => {
      server.close((e) => (e ? reject(e) : resolve()));
      server.closeAllConnections();
    });
  try {
    await t.test(
      "UAE midnight, leap dates, exclusive report end and duty transitions",
      () => {
        assert.equal(businessDay("2026-10-19T19:59:59Z"), "2026-10-19");
        assert.equal(businessDay("2026-10-19T20:00:00Z"), "2026-10-20");
        assert.deepEqual(dayRange("2026-10-20", "2026-10-20"), [
          "2026-10-20T00:00:00+04:00",
          "2026-10-21T00:00:00+04:00",
        ]);
        assert.equal(calendarDate.safeParse("2026-02-30").success, false);
        assert.equal(calendarDate.safeParse("2028-02-29").success, true);
        assert.equal(nextDuty("off", "start"), "on");
        assert.equal(nextDuty("on", "rest"), "rest");
        assert.equal(nextDuty("rest", "return"), "on");
        assert.equal(nextDuty("on", "end"), "off");
        assert.throws(() => nextDuty("rest", "end"));
        assert.throws(() => nextDuty("on", "start"));
      },
    );
    await t.test(
      "every operational endpoint requires a session; invalid login and CSRF/origin denied",
      async () => {
        for (const path of [
          "/me",
          "/shops",
          "/shops/" + shop,
          "/visits",
          "/dashboard",
          "/metadata",
          "/duty",
          "/accounts",
          "/exports",
        ])
          assert.equal((await request(path)).status, 401, path);
        assert.equal(
          (
            await request("/checkin", undefined, {
              shopId: shop,
              location: { availability: "denied" },
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request("/login", undefined, {
              email: "ahmed@local.invalid",
              password: "wrong",
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request(
              "/checkin",
              ahmed,
              { shopId: shop, location: { availability: "denied" } },
              undefined,
              { "X-CSRF-Token": "tampered" },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              "/checkin",
              ahmed,
              { shopId: shop, location: { availability: "denied" } },
              undefined,
              { Origin: "https://other.invalid" },
            )
          ).status,
          403,
        );
        assert.equal((await request("/accounts", manager)).status, 403);
        assert.equal((await request("/accounts", ahmed)).status, 403);
        assert.equal((await request("/accounts", admin)).status, 200);
        assert.equal((await request("/leads", manager, {})).status, 403);
      },
    );
    await t.test(
      "700 synthetic shops, paginated server search, shared history and no assignment-only read filter",
      async () => {
        const all = await request("/shops", ahmed);
        assert.equal(all.data.total, 700);
        assert.equal(all.data.rows.length, 40);
        assert.equal(
          (await request("/shops?q=Synthetic%20Shop%200700", naseer)).data.rows
            .length,
          1,
        );
        assert.equal((await request("/shops?q=%25", naseer)).data.total, 0);
        const history = await request("/shops/" + shop, naseer);
        assert.equal(history.status, 200);
        assert.equal(history.data.visits.length, 8);
        assert.notEqual(history.data.shop.assigned_executive_id, naseer.id);
      },
    );
    await t.test(
      "validation rejects spoofed actor/timestamps, invalid GPS and whitespace discussion",
      async () => {
        assert.equal(
          (
            await request("/checkin", ahmed, {
              shopId: shop,
              location: { availability: "denied" },
              visitorId: naseer.id,
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await request("/checkin", ahmed, {
              shopId: shop,
              location: {
                availability: "captured",
                latitude: 91,
                longitude: 55,
                accuracy: 10,
                capturedAt: new Date().toISOString(),
              },
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await request("/checkin", manager, {
              shopId: shop,
              location: { availability: "denied" },
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "concurrent duplicate check-in commits one visit, one audit event and one response",
      async () => {
        const key = randomUUID(),
          body = { shopId: shop, location: { availability: "denied" } };
        const replies = await Promise.all([
          request("/checkin", ahmed, body, key),
          request("/checkin", ahmed, body, key),
        ]);
        assert.deepEqual(
          replies.map((r) => r.status),
          [200, 200],
        );
        assert.equal(replies[0].data.visit.id, replies[1].data.visit.id);
        visitId = replies[0].data.visit.id;
        const v = replies[0].data.visit;
        assert.equal(v.visitor_id, ahmed.id);
        assert.equal(v.created_by, ahmed.id);
        assert.equal(v.location.availability, "denied");
        assert.equal(
          (
            await db.query<{ n: number }>(
              "SELECT count(*)::int AS n FROM audit_events WHERE entity_id=$1 AND action='visit.checkin'",
              [visitId],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await request(
              "/checkin",
              ahmed,
              { shopId: otherShop, location: { availability: "denied" } },
              key,
            )
          ).status,
          409,
        );
      },
    );
    await t.test(
      "one open visit per executive and per shop; cross-owner checkout denied",
      async () => {
        assert.equal(
          (
            await request("/checkin", ahmed, {
              shopId: otherShop,
              location: { availability: "denied" },
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request("/checkin", naseer, {
              shopId: shop,
              location: { availability: "denied" },
            })
          ).status,
          409,
        );
        assert.equal(
          (await request(`/visits/${visitId}/checkout`, naseer, checkout))
            .status,
          403,
        );
        assert.equal(
          (await request(`/visits/${visitId}/checkout`, manager, checkout))
            .status,
          403,
        );
        assert.equal(
          (
            await request(`/visits/${visitId}/checkout`, ahmed, {
              ...checkout,
              notes: "  ",
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await request(`/visits/${visitId}/checkout`, ahmed, {
              ...checkout,
              followUpDate: "2020-01-01",
            })
          ).status,
          422,
        );
      },
    );
    await t.test(
      "checkout retry is atomic, follow-up owned by visitor, and previous follow-up survives",
      async () => {
        const before = (await request("/shops/" + shop, ahmed)).data;
        const key = randomUUID(),
          replies = await Promise.all([
            request(`/visits/${visitId}/checkout`, ahmed, checkout, key),
            request(`/visits/${visitId}/checkout`, ahmed, checkout, key),
          ]);
        assert.deepEqual(
          replies.map((r) => r.status),
          [200, 200],
        );
        assert.deepEqual(replies[0].data, replies[1].data);
        followupId = replies[0].data.followup.id;
        const after = (await request("/shops/" + shop, manager)).data;
        assert.equal(after.visits.length, 9);
        assert.equal(after.followups.length, before.followups.length + 1);
        assert.equal(
          after.shop.assigned_executive_id,
          before.shop.assigned_executive_id,
        );
        assert.equal(after.shop.status, before.shop.status);
        assert.equal(replies[0].data.followup.owner_id, ahmed.id);
        assert.equal(replies[0].data.followup.visit_id, visitId);
        assert.equal(replies[0].data.followup.due_date, "2099-01-02");
        assert.equal(
          after.followups.find((f: any) => f.id === before.followups[0].id)
            .status,
          "pending",
        );
        assert.equal(
          (
            await request(`/visits/${visitId}/checkout`, ahmed, {
              ...checkout,
              notes: "Overwrite attempt",
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "different checkout requests race: one completes and one conflicts without overwrite",
      async () => {
        const opened = await request("/checkin", naseer, {
          shopId: otherShop,
          location: { availability: "unavailable" },
        });
        const id = opened.data.visit.id;
        const replies = await Promise.all([
          request(`/visits/${id}/checkout`, naseer, {
            ...checkout,
            notes: "Race A",
            followUpDate: null,
          }),
          request(`/visits/${id}/checkout`, naseer, {
            ...checkout,
            notes: "Race B",
            followUpDate: null,
          }),
        ]);
        assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
        const v = (
          await request("/shops/" + otherShop, manager)
        ).data.visits.find((v: any) => v.id === id);
        assert.ok(["Race A", "Race B"].includes(v.notes));
        assert.notEqual(
          (await request("/shops/" + otherShop, manager)).data.shop
            .assigned_executive_id,
          naseer.id,
        );
      },
    );
    await t.test(
      "simultaneous check-ins by different executives at the same shop yield a single winner",
      async () => {
        const body = {
          shopId: syntheticId("shop-5"),
          location: { availability: "timeout" },
        };
        const replies = await Promise.all([
          request("/checkin", ahmed, body),
          request("/checkin", naseer, body),
        ]);
        assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
        const i = replies.findIndex((r) => r.status === 200);
        const auth = i === 0 ? ahmed : naseer;
        assert.equal(
          (
            await request(
              `/visits/${replies[i].data.visit.id}/checkout`,
              auth,
              { ...checkout, followUpDate: null },
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      "explicit follow-up reschedule, optimistic concurrency, completion and preservation",
      async () => {
        assert.equal(
          (
            await request("/followups/" + followupId, naseer, {
              action: "complete",
              reason: "Wrong owner",
              version: 1,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request("/followups/" + followupId, ahmed, {
              action: "reschedule",
              reason: "Customer requested next week",
              version: 1,
              dueDate: "2099-01-09",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request("/followups/" + followupId, ahmed, {
              action: "complete",
              reason: "Stale tab",
              version: 1,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request("/followups/" + followupId, ahmed, {
              action: "complete",
              reason: "Customer contacted",
              version: 2,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request("/followups/" + followupId, ahmed, {
              action: "cancel",
              reason: "Already finished",
              version: 3,
            })
          ).status,
          409,
        );
        const f = (await request("/shops/" + shop, ahmed)).data.followups.find(
          (f: any) => f.id === followupId,
        );
        assert.equal(f.status, "completed");
        assert.equal(f.due_date, "2099-01-09");
      },
    );
    await t.test(
      "new discovery retry preserves creator/assignee/visitor and atomic save-and-check-in rollback",
      async () => {
        const body = {
          name: "<img src=x onerror=alert(1)> Synthetic discovery",
          contact: "Test contact",
          phone: "+971 50 000 0000",
          area: "Al Quoz",
          location: "Synthetic test address",
          notes: "Test notes",
          assignedExecutiveId: ahmed.id,
          checkIn: true,
          gps: { availability: "not_requested" },
        };
        const key = randomUUID(),
          a = await request("/leads", ahmed, body, key),
          b = await request("/leads", ahmed, body, key);
        assert.equal(a.status, 200);
        assert.equal(a.data.shop.id, b.data.shop.id);
        assert.equal(a.data.shop.created_by, ahmed.id);
        assert.equal(a.data.shop.assigned_executive_id, ahmed.id);
        assert.equal(a.data.visit.visitor_id, ahmed.id);
        assert.equal(
          (
            await request("/leads", ahmed, {
              ...body,
              assignedExecutiveId: naseer.id,
            })
          ).status,
          403,
        );
        const before = (await request("/shops", ahmed)).data.total;
        assert.equal(
          (
            await request("/leads", ahmed, {
              ...body,
              name: "Should roll back",
            })
          ).status,
          409,
        );
        assert.equal((await request("/shops", ahmed)).data.total, before);
        assert.equal(
          (
            await request(`/visits/${a.data.visit.id}/checkout`, ahmed, {
              ...checkout,
              followUpDate: null,
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "duty start/rest/return/end, duplicate taps, invalid transition, privacy and visit independence",
      async () => {
        const before = (await request("/visits", ahmed)).data.total;
        const key = randomUUID(),
          results = await Promise.all([
            request("/duty/start", ahmed, { expectedSessionId: null }, key),
            request("/duty/start", ahmed, { expectedSessionId: null }, key),
          ]);
        assert.deepEqual(
          results.map((r) => r.status),
          [200, 200],
        );
        assert.equal(results[0].data.sessionId, results[1].data.sessionId);
        dutyId = results[0].data.sessionId;
        assert.equal(
          (await request("/duty/start", ahmed, { expectedSessionId: null }))
            .status,
          409,
        );
        assert.equal(
          (await request("/duty/rest", ahmed, { expectedSessionId: dutyId }))
            .status,
          200,
        );
        assert.equal(
          (await request("/duty/rest", ahmed, { expectedSessionId: dutyId }))
            .status,
          409,
        );
        assert.equal(
          (await request("/duty/end", ahmed, { expectedSessionId: dutyId }))
            .status,
          409,
        );
        assert.equal(
          (await request("/duty/return", ahmed, { expectedSessionId: dutyId }))
            .status,
          200,
        );
        assert.equal(
          (await request("/duty/end", ahmed, { expectedSessionId: dutyId }))
            .status,
          200,
        );
        assert.equal(
          (await request("/duty?person=" + ahmed.id, naseer)).status,
          403,
        );
        assert.equal((await request("/duty", manager)).data.sessions.length, 1);
        assert.equal((await request("/duty", naseer)).data.sessions.length, 0);
        assert.equal(
          (await request("/duty/start", manager, { expectedSessionId: null }))
            .status,
          403,
        );
        assert.equal((await request("/visits", ahmed)).data.total, before);
        const history = (await request("/duty", ahmed)).data;
        assert.ok(history.sessions[0].ended_at);
        assert.ok(history.rests[0].ended_at);
      },
    );
    await t.test(
      "overnight duty/rest retains exact instants across UAE midnight and supports a second rest interval",
      async () => {
        const session = randomUUID();
        await db.query(
          "INSERT INTO duty_sessions(id,organization_id,executive_id,started_at,ended_at) VALUES($1,$2,$3,'2026-01-19T19:50:00Z','2026-01-19T20:30:00Z')",
          [session, fixture.organizationId, ahmed.id],
        );
        await db.query(
          "INSERT INTO rest_intervals(id,organization_id,session_id,started_at,ended_at) VALUES($1,$2,$3,'2026-01-19T19:55:00Z','2026-01-19T20:05:00Z')",
          [randomUUID(), fixture.organizationId, session],
        );
        const result = (await request("/duty", manager)).data,
          s = result.sessions.find((s: any) => s.id === session),
          r = result.rests.find((r: any) => r.session_id === session);
        assert.equal(businessDay(s.started_at), "2026-01-19");
        assert.equal(businessDay(s.ended_at), "2026-01-20");
        assert.equal(businessDay(r.started_at), "2026-01-19");
        assert.equal(businessDay(r.ended_at), "2026-01-20");
        const fresh = (
          await request("/duty/start", ahmed, { expectedSessionId: null })
        ).data.sessionId;
        for (let i = 0; i < 2; i++) {
          assert.equal(
            (await request("/duty/rest", ahmed, { expectedSessionId: fresh }))
              .status,
            200,
          );
          assert.equal(
            (await request("/duty/return", ahmed, { expectedSessionId: fresh }))
              .status,
            200,
          );
        }
        assert.equal(
          (await request("/duty/end", ahmed, { expectedSessionId: fresh }))
            .status,
          200,
        );
        assert.equal(
          (await request("/duty", ahmed)).data.rests.filter(
            (r: any) => r.session_id === fresh,
          ).length,
          2,
        );
      },
    );
    await t.test(
      "database reporting uses UAE date boundaries including exclusive next midnight",
      async () => {
        for (const [label, instant] of [
          ["before", "2026-01-19T19:59:59Z"],
          ["start", "2026-01-19T20:00:00Z"],
          ["end", "2026-01-20T20:00:00Z"],
        ]) {
          await db.query(
            `INSERT INTO visits(id,organization_id,shop_id,visitor_id,created_by,checked_in_at,checked_out_at,lifecycle,outcome,notes,location) VALUES($1,$2,$3,$4,$4,$5,$5,'completed','Regular Visit',$6,'{"availability":"not_requested"}')`,
            [
              randomUUID(),
              fixture.organizationId,
              shop,
              ahmed.id,
              instant,
              `Boundary ${label}`,
            ],
          );
        }
        const r = await request(
          "/visits?from=2026-01-20&to=2026-01-20&q=Boundary",
          manager,
        );
        assert.equal(r.status, 200);
        assert.equal(r.data.total, 1);
        assert.equal(r.data.rows[0].notes, "Boundary start");
        assert.equal(
          (await request("/visits?from=2026-02-30", manager)).status,
          422,
        );
        assert.equal(
          (await request("/visits?from=2026-02-20&to=2026-01-20", manager))
            .status,
          400,
        );
      },
    );
    await t.test(
      "audit events cannot be edited, foreign keys reject orphan records, unapproved operations unavailable",
      async () => {
        await assert.rejects(
          () =>
            db.query(
              "UPDATE audit_events SET action='changed' WHERE entity_id=$1",
              [visitId],
            ),
          /append-only/,
        );
        await assert.rejects(() =>
          db.query("UPDATE visits SET shop_id=$1 WHERE id=$2", [
            randomUUID(),
            visitId,
          ]),
        );
        for (const path of [
          "/imports",
          "/exports",
          "/corrections",
          "/assignments",
          "/conversions",
        ])
          assert.equal((await request(path, manager, {})).status, 409, path);
        const gated = application(db, {
          ...settings,
          visitPolicy: "pending",
          dutyPolicy: "pending",
        });
        await new Promise<void>((resolve) =>
          gated.listen(0, "127.0.0.1", resolve),
        );
        const original = settings.origin;
        const gateOrigin = `http://127.0.0.1:${(gated.address() as { port: number }).port}`;
        // Gate server intentionally uses its own origin, so construct it after choosing an unused ephemeral port.
        await new Promise<void>((resolve) => gated.close(() => resolve()));
        const gateConfig = {
          ...settings,
          origin: gateOrigin,
          visitPolicy: "pending",
          dutyPolicy: "pending",
        };
        const gate = application(db, gateConfig);
        await new Promise<void>((resolve) =>
          gate.listen(Number(new URL(gateOrigin).port), "127.0.0.1", resolve),
        );
        try {
          const r = await fetch(`${gateOrigin}/api/checkin`, {
            method: "POST",
            headers: {
              Origin: gateOrigin,
              Cookie: ahmed.cookie,
              "X-CSRF-Token": ahmed.csrf,
              "Content-Type": "application/json",
              "Idempotency-Key": randomUUID(),
            },
            body: JSON.stringify({
              shopId: shop,
              location: { availability: "denied" },
            }),
          });
          assert.equal(r.status, 409);
          assert.equal((await r.json()).error.code, "POLICY_PENDING");
        } finally {
          await new Promise<void>((resolve) => gate.close(() => resolve()));
        }
        settings.origin = original;
      },
    );
    await t.test(
      "closing and reopening disk database preserves visits, follow-ups, sessions and duty for a second session",
      async () => {
        await endServer();
        await db.close();
        await cp(path, join(directory, "offline-backup"), {
          recursive: true,
          errorOnExist: true,
          force: false,
        });
        db = await openDatabase(path);
        server = application(db, settings);
        await listen();
        const second = await signIn("manager");
        const result = await request("/shops/" + shop, second);
        assert.equal(result.status, 200);
        assert.ok(
          result.data.visits.some(
            (v: any) => v.id === visitId && v.lifecycle === "completed",
          ),
        );
        assert.equal(
          result.data.followups.find((f: any) => f.id === followupId).status,
          "completed",
        );
        assert.equal((await request("/me", ahmed)).status, 200);
        assert.ok(
          (await request("/duty", second)).data.sessions.find(
            (s: any) => s.id === dutyId && s.ended_at,
          ),
        );
      },
    );
    await t.test(
      "offline backup opens at a separate restore path and retains the completed visit",
      async () => {
        const restored = await openDatabase(join(directory, "offline-backup"));
        try {
          assert.equal(
            (
              await restored.query<{ lifecycle: string }>(
                "SELECT lifecycle FROM visits WHERE id=$1",
                [visitId],
              )
            ).rows[0].lifecycle,
            "completed",
          );
          await migrate(restored);
        } finally {
          await restored.close();
        }
        await assert.rejects(() => openDatabase(path), /already open/);
      },
    );
    await t.test(
      "organization boundaries deny foreign shop history, check-in and duty reads",
      async () => {
        const organization = randomUUID(),
          foreignShop = randomUUID(),
          password = "Synthetic-Isolation-" + randomUUID();
        let user = "";
        await db.transaction(async (tx) => {
          await tx.query("INSERT INTO organizations(id,name) VALUES($1,$2)", [
            organization,
            "Synthetic separate organization",
          ]);
          user = await createAccount(
            tx,
            organization,
            "separate@local.invalid",
            "Separate Executive",
            "executive",
            password,
          );
          await tx.query(
            "INSERT INTO shops(id,organization_id,name,area,status,assigned_executive_id,created_by,synthetic) VALUES($1,$2,'Separate shop','Al Quoz','Customer',$3,$3,true)",
            [foreignShop, organization, user],
          );
        });
        const signed = await request("/login", undefined, {
          email: "separate@local.invalid",
          password,
        });
        const foreign = {
          cookie: signed.cookie!.split(";")[0],
          csrf: signed.data.csrf,
          id: user,
        };
        assert.equal((await request("/shops/" + shop, foreign)).status, 404);
        assert.equal(
          (await request("/shops/" + foreignShop, ahmed)).status,
          404,
        );
        assert.equal(
          (
            await request("/checkin", foreign, {
              shopId: shop,
              location: { availability: "not_requested" },
            })
          ).status,
          404,
        );
        assert.equal((await request("/shops", foreign)).data.total, 1);
        assert.equal(
          (await request("/duty?person=" + ahmed.id, foreign)).status,
          403,
        );
        await db.query(
          "INSERT INTO import_batches(id,organization_id,source_name,source_hash,status,created_by) VALUES($1,$2,'synthetic.csv','synthetic-hash','staged',$3)",
          [syntheticId("foreign-import"), organization, user],
        );
        await assert.rejects(() =>
          db.query("UPDATE shops SET import_batch_id=$1 WHERE id=$2", [
            syntheticId("foreign-import"),
            shop,
          ]),
        );
      },
    );
    await t.test(
      "admin creates a real account with retry safety and without plaintext password records",
      async () => {
        const password = "Synthetic-Admin-" + randomUUID(),
          body = {
            email: "added@local.invalid",
            name: "Added Executive",
            role: "executive",
            password,
          },
          key = randomUUID();
        assert.equal((await request("/accounts", manager, body)).status, 403);
        const a = await request("/accounts", admin, body, key),
          b = await request("/accounts", admin, body, key);
        assert.equal(a.status, 200);
        assert.equal(a.data.id, b.data.id);
        const stored = (
          await db.query<Record<string, any>>(
            "SELECT password_hash FROM users WHERE id=$1",
            [a.data.id],
          )
        ).rows[0];
        assert.ok(stored.password_hash.startsWith("scrypt-v1:"));
        assert.equal(stored.password_hash.includes(password), false);
        const audit = (
          await db.query<Record<string, any>>(
            "SELECT details FROM audit_events WHERE entity_id=$1",
            [a.data.id],
          )
        ).rows[0].details;
        assert.equal(JSON.stringify(audit).includes(password), false);
        assert.equal(JSON.stringify(a.data).includes(password), false);
        assert.equal(
          (await request("/login", undefined, { email: body.email, password }))
            .status,
          200,
        );
      },
    );
    await t.test(
      "session revocation and expiry prevent subsequent reads",
      async () => {
        const session = await signIn("naseer");
        assert.equal((await request("/logout", session, {})).status, 200);
        assert.equal((await request("/me", session)).status, 401);
        await db.query(
          "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",
          [ahmed.id],
        );
        assert.equal((await request("/shops", ahmed)).status, 401);
      },
    );
  } finally {
    await endServer();
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
