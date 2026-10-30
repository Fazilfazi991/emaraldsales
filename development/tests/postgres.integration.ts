import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { resolve, join, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { openPostgres, migratePostgres, verifyRuntimeRole, verifySyntheticWorkspace } from "../src/postgres.js";
import { verifyMigrations, type Database, type Queryable } from "../src/database.js";
import { seedSynthetic, syntheticId } from "../src/fixtures.js";
import { createAccount } from "../src/auth.js";
import { importPilotBatch } from "../src/pilot-import.js";
import { application } from "../src/server.js";
import type { Config } from "../src/config.js";

test("Real PostgreSQL: restricted runtime, independent connections and authenticated journeys", async t => {
  const connectionString = process.env.CRM_LOCAL_PG_TEST_URL;
  assert.ok(connectionString, "Set CRM_LOCAL_PG_TEST_URL to a disposable loopback PostgreSQL cluster");
  // openPostgres validates loopback before any network connection; remote services are never touched.
  const admin = openPostgres({ connectionString, localTest: true, max: 1 });
  const name = "emerald_test_" + randomUUID().replaceAll("-", "");
  const operator = name + "_owner", runtime = name + "_runtime", importer = name + "_importer";
  let owner: ReturnType<typeof openPostgres> | undefined, db: ReturnType<typeof openPostgres> | undefined, importDb: ReturnType<typeof openPostgres> | undefined;
  try {
    await admin.pool.query(`CREATE ROLE ${operator} LOGIN`);
    await admin.pool.query(`CREATE ROLE ${runtime} LOGIN`);
    await admin.pool.query(`CREATE ROLE ${importer} LOGIN`);
    await admin.pool.query(`CREATE DATABASE ${name} OWNER ${operator}`);
    const url = new URL(connectionString); url.pathname = "/" + name; url.username = operator;
    owner = openPostgres({ connectionString: url.toString(), localTest: true, max: 3 });
    const ownerDb = owner;
    await t.test("TLS verifies both certificate trust and hostname", async () => {
      const caFile = process.env.CRM_LOCAL_PG_TEST_CA;
      assert.ok(caFile, "Supply the disposable local server certificate for TLS acceptance");
      const ca = await readFile(caFile, "utf8");
      const tlsUrl = new URL(url); tlsUrl.hostname = "localhost";
      const trusted = openPostgres({ connectionString: tlsUrl.toString(), ca, max: 1 });
      try { assert.equal((await trusted.query<{ ok: number }>("SELECT 1 ok")).rows[0].ok, 1); }
      finally { await trusted.close(); }
      const untrusted = openPostgres({ connectionString: tlsUrl.toString(), max: 1 });
      try { await assert.rejects(() => untrusted.query("SELECT 1"), (error: any) => ["DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN"].includes(error.code)); }
      finally { await untrusted.close(); }
      tlsUrl.hostname = "127.0.0.1";
      const wrongName = openPostgres({ connectionString: tlsUrl.toString(), ca, max: 1 });
      try { await assert.rejects(() => wrongName.query("SELECT 1"), (error: any) => error.code === "ERR_TLS_CERT_ALTNAME_INVALID"); }
      finally { await wrongName.close(); }
    });
    await t.test("Concurrent migration runners serialize and preserve checksums", async () => {
      await Promise.all([migratePostgres(ownerDb), migratePostgres(ownerDb)]);
      await verifyMigrations(ownerDb);
      assert.equal((await ownerDb.query<{ n: number }>("SELECT count(*)::int n FROM schema_migrations")).rows[0].n, 6);
      await assert.rejects(() => verifyRuntimeRole(ownerDb));
    });
    const fixture = await seedSynthetic(owner, 36);
    const grants = (await readFile(new URL("../operations/staging-grants.sql", import.meta.url), "utf8")).replaceAll("emerald_runtime", runtime);
    await owner.pool.query(grants);
    const importGrants = (await readFile(new URL("../operations/import-grants.sql", import.meta.url), "utf8")).replaceAll("emerald_importer", importer);
    await owner.pool.query(importGrants);
    url.username = importer;
    importDb = openPostgres({ connectionString: url.toString(), localTest: true, max: 1 });
    url.username = runtime;
    db = openPostgres({ connectionString: url.toString(), localTest: true, max: 5 });
    const runtimeDb = db;
    await t.test("Pipelined reads retain server timeouts, reject writes and recover after errors",async()=>{
      assert.ok(runtimeDb.read);
      const settings=(await runtimeDb.read<{statement:string;lock:string;idle:string;zone:string}>("SELECT current_setting('statement_timeout') AS statement,current_setting('lock_timeout') AS lock,current_setting('idle_in_transaction_session_timeout') AS idle,current_setting('TimeZone') AS zone")).rows[0];
      assert.deepEqual(settings,{statement:'15s',lock:'5s',idle:'20s',zone:'UTC'});
      await assert.rejects(()=>runtimeDb.read!("UPDATE shops SET notes='must never be saved'"),(error:any)=>error.code==='25006');
      await assert.rejects(()=>runtimeDb.read!("SELECT missing_column FROM shops"),(error:any)=>error.code==='42703');
      assert.equal((await runtimeDb.read<{n:number}>("SELECT 1 AS n")).rows[0].n,1);
      // These checks run against PostgreSQL, not a client-side timeout approximation.
      await assert.rejects(()=>runtimeDb.read!("SELECT pg_sleep(16)"),(error:any)=>error.code==='57014');
      assert.equal((await runtimeDb.read<{n:number}>("SELECT 2 AS n")).rows[0].n,2);
    });
    await t.test("Runtime role passes; audit mutation, schema writes and DDL are denied", async () => {
      await verifyRuntimeRole(runtimeDb); await verifyMigrations(runtimeDb);
      await verifySyntheticWorkspace(runtimeDb);
      await ownerDb.transaction(async tx => {
        await tx.query("UPDATE organizations SET name='Not a synthetic staging workspace'");
        await assert.rejects(() => verifySyntheticWorkspace(tx));
        await tx.query("UPDATE organizations SET name=$1", ["Emerald Interlink · Synthetic review workspace"]);
      });
      for (const sql of ["UPDATE audit_events SET action='changed'", "DELETE FROM audit_events", "TRUNCATE audit_events", "DELETE FROM schema_migrations", "CREATE TABLE unexpected(id int)"])
        await assert.rejects(() => runtimeDb.query(sql), (error: any) => error.code === "42501");
    });
    await t.test("Transactions use independent backend connections and roll back atomically", async () => {
      const ids = await Promise.all([1, 2].map(() => runtimeDb.transaction(async tx => {
        const id = (await tx.query<{ id: number }>("SELECT pg_backend_pid() id")).rows[0].id;
        await tx.query("SELECT pg_sleep(0.05)"); return id;
      })));
      assert.notEqual(ids[0], ids[1]);
      await assert.rejects(() => runtimeDb.transaction(async tx => {
        await tx.query("UPDATE shops SET notes='must roll back' WHERE id=$1", [syntheticId("shop-1")]);
        throw new Error("Synthetic rollback");
      }));
      assert.notEqual((await runtimeDb.query<{ notes: string }>("SELECT notes FROM shops WHERE id=$1", [syntheticId("shop-1")])).rows[0].notes, "must roll back");
    });
    let failAudit = false;
    const wrapped: Database = { query: runtimeDb.query, close: async () => {}, transaction: work => runtimeDb.transaction(tx => work({
      query: ((sql: string, args?: unknown[]) => {
        if (failAudit && sql.startsWith("INSERT INTO audit_events")) { failAudit = false; throw new Error("Synthetic pre-commit failure"); }
        return tx.query(sql, args).catch(error => { console.error({ pgTestCode: error.code, pgTestMessage: error.message }); throw error; });
      }) as Queryable["query"],
    })) };
    const settings: Config = { host: "127.0.0.1", port: 0, origin: "http://127.0.0.1", dataDir: "", secure: true,
      visitPolicy: "approved-v2", dutyPolicy: "approved-v1", trustedProxy: "vercel" };
    const server = application(wrapped, settings);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    settings.origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    type Auth = { cookie: string; csrf: string };
    async function request(path: string, auth?: Auth, body?: unknown, key = randomUUID(), headers = {}) {
      const response = await fetch(settings.origin + "/api" + path, { method: body === undefined ? "GET" : "POST",
        headers: { Origin: settings.origin, "x-vercel-forwarded-for": "203.0.113.10", ...(auth ? { Cookie: auth.cookie, "X-CSRF-Token": auth.csrf } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json", "Idempotency-Key": key }), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body) });
      return { response, data: response.headers.get("content-type")?.includes("application/json") ? await response.json() : Buffer.from(await response.arrayBuffer()) };
    }
    async function signIn(slug: string): Promise<Auth> {
      const account = fixture.accounts.find(a => a.email === slug + "@local.invalid")!;
      const result = await request("/login", undefined, { email: account.email, password: account.password });
      assert.equal(result.response.status, 200);
      assert.match(result.response.headers.get("set-cookie")!, /; Secure/);
      return { cookie: result.response.headers.get("set-cookie")!.split(";")[0], csrf: result.data.csrf };
    }
    try {
      const first = await signIn("ahmed"), second = await signIn("naseer"), manager = await signIn("manager");
      let visit = "", followup = "", dutyId = "";
      const location = { availability: "denied" };
      const shop = syntheticId("shop-1");
      await t.test("Anonymous, CSRF, hostile origin and wrong-role report access are rejected", async () => {
        assert.equal((await request("/me")).response.status, 401);
        assert.equal((await request("/duty/start", first, {}, undefined, { "X-CSRF-Token": "wrong" })).response.status, 403);
        assert.equal((await request("/duty/start", first, {}, undefined, { Origin: "https://hostile.invalid" })).response.status, 403);
        assert.equal((await request("/reports/activity", first)).response.status, 403);
      });
      await t.test("Duty starts independently; concurrent different-shop visits have one winner", async () => {
        const duty = await request("/duty/start", first, { expectedSessionId: null });
        assert.equal(duty.response.status, 200);
        dutyId = (await runtimeDb.query<{ id: string }>("SELECT id FROM duty_sessions WHERE ended_at IS NULL")).rows[0].id;
        const raced = await Promise.all([shop, syntheticId("shop-2")].map(shopId => request("/checkin", first, { shopId, location })));
        assert.deepEqual(raced.map(r => r.response.status).sort(), [200, 409]);
        visit = raced.find(r => r.response.status === 200)!.data.visit.id;
      });
      await t.test("Second executive can visit the same shop; cross-performer checkout is denied", async () => {
        const selected = (await runtimeDb.query<{ shop_id: string }>("SELECT shop_id FROM visits WHERE id=$1", [visit])).rows[0].shop_id;
        assert.equal((await request("/checkin", second, { shopId: selected, location })).response.status, 200);
        assert.equal((await request(`/visits/${visit}/checkout`, second, { outcome: "Regular Visit", notes: "Synthetic review", orderStatus: "No Order", followUpDate: null })).response.status, 403);
      });
      await t.test("Checkout failure rolls back all writes, then exact retry and duplicate replay succeed", async () => {
        const key = randomUUID(), body = { outcome: "Follow-up Required", notes: "Synthetic PostgreSQL journey", orderStatus: "No Order", followUpDate: "2026-11-01" };
        failAudit = true;
        assert.equal((await request(`/visits/${visit}/checkout`, first, body, key)).response.status, 500);
        assert.equal((await runtimeDb.query<{ lifecycle: string }>("SELECT lifecycle FROM visits WHERE id=$1", [visit])).rows[0].lifecycle, "open");
        const [a, b] = await Promise.all([request(`/visits/${visit}/checkout`, first, body, key), request(`/visits/${visit}/checkout`, first, body, key)]);
        assert.equal(a.response.status, 200); assert.equal(b.response.status, 200); assert.deepEqual(a.data, b.data);
        followup = (await runtimeDb.query<{ id: string }>("SELECT id FROM followups WHERE visit_id=$1", [visit])).rows[0].id;
      });
      await t.test("Follow-up reschedule and completion preserve the completed visit", async () => {
        const row = (await runtimeDb.query<{ version: number }>("SELECT version FROM followups WHERE id=$1", [followup])).rows[0];
        assert.equal((await request(`/followups/${followup}`, first, { action: "reschedule", dueDate: "2026-11-02", reason: "Synthetic customer request", version: row.version })).response.status, 200);
        assert.equal((await request(`/followups/${followup}`, first, { action: "complete", reason: "Synthetic contact completed", version: row.version + 1 })).response.status, 200);
      });
      await t.test("Break, return and duty end persist; fresh sign-in retains saved history", async () => {
        for (const action of ["rest", "return", "end"]) assert.equal((await request(`/duty/${action}`, first, { expectedSessionId: dutyId })).response.status, 200);
        assert.equal((await request("/logout", first, {})).response.status, 200);
        assert.equal((await request("/me", first)).response.status, 401);
        const fresh = await signIn("ahmed");
        assert.equal((await request("/me", fresh)).response.status, 200);
        assert.equal((await runtimeDb.query<{ lifecycle: string }>("SELECT lifecycle FROM visits WHERE id=$1", [visit])).rows[0].lifecycle, "completed");
      });
      await t.test("Manager reports use real PostgreSQL snapshots and return native Excel and PDF", async () => {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        const params = `from=${today}&to=${today}`;
        const report = await request(`/reports/activity?${params}`, manager);
        assert.equal(report.response.status, 200); assert.ok(report.data.total >= 1);
        for (const format of ["xlsx", "pdf"]) {
          const result = await request(`/reports/activity/export?${params}&format=${format}`, manager);
          assert.equal(result.response.status, 200);
          assert.equal(result.data.subarray(0, format === "pdf" ? 4 : 2).toString(), format === "pdf" ? "%PDF" : "PK");
        }
      });
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
    await t.test("Default hosted entrypoint boots against TLS PostgreSQL and serves authenticated native exports", async () => {
      const ca = await readFile(process.env.CRM_LOCAL_PG_TEST_CA!, "utf8");
      const connection = new URL(url); connection.hostname = "localhost";
      const origin = "https://crm-staging.example.invalid";
      const artifact = process.env.CRM_VERCEL_ARTIFACT_DIR ? resolve(process.env.CRM_VERCEL_ARTIFACT_DIR) : undefined;
      let entry = pathToFileURL(resolve("server.ts")).href;
      if (artifact) {
        const metadata = JSON.parse(await readFile(join(artifact, "artifact-metadata.json"), "utf8"));
        const path = resolve(artifact, metadata.handler), rel = relative(artifact, path);
        assert.ok(rel && !rel.startsWith("..") && !isAbsolute(rel));
        assert.equal(metadata.runtime, "nodejs22.x");
        assert.notEqual(metadata.handler, "app.js");
        entry = pathToFileURL(path).href;
      }
      const child = spawn(process.execPath, [...(artifact ? [] : ["--import", "tsx"]), "--input-type=module", "-e",
        `import {createServer} from 'node:http';import handler from ${JSON.stringify(entry)};const server=createServer(handler);server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:server.address().port})));`],
        { cwd: artifact, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, VERCEL: "1", NODE_ENV: "production",
          CRM_HOSTED_STAGE: "approved-synthetic-staging", APP_ORIGIN: origin, DATABASE_URL: connection.toString(),
          DATABASE_SSL_CA: ca, VISIT_POLICY: "approved-v2", DUTY_POLICY: "approved-v1" } });
      const stages: string[] = [];
      child.stderr.on("data", chunk => {
        for (const line of String(chunk).split("\n")) {
          try { const event = JSON.parse(line); if (event.event === "hosted_startup_unavailable" && /^[a-z_]+$/.test(event.stage)) stages.push(event.stage); } catch {}
        }
      });
      try {
        const port = await new Promise<number>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Hosted smoke server startup timed out")), 15000);
          child.once("exit", () => { clearTimeout(timer); reject(new Error("Hosted smoke server exited")); });
          let output = "";
          child.stdout.on("data", chunk => {
            output += chunk;
            if (output.includes("\n")) { clearTimeout(timer); try { resolve(JSON.parse(output.trim()).port); } catch { reject(new Error("Invalid hosted smoke signal")); } }
          });
        });
        const headers = { Host: new URL(origin).host, Origin: origin, "x-vercel-forwarded-for": "203.0.113.10" };
        const base = `http://127.0.0.1:${port}`;
        const raw = (path: string, extra: Record<string, string> = {}, body?: unknown) => new Promise<{ status: number; headers: import("node:http").IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
          const request = httpRequest(base + path, { method: body ? "POST" : "GET", headers: { ...headers, ...extra, ...(body ? { "Content-Type": "application/json" } : {}) } }, response => {
            const chunks: Buffer[] = []; response.on("data", chunk => chunks.push(chunk));
            response.on("end", () => resolve({ status: response.statusCode!, headers: response.headers, body: Buffer.concat(chunks) }));
          }); request.on("error", reject); request.end(body ? JSON.stringify(body) : undefined);
        });
        const page = await raw("/"); assert.equal(page.status, 200, `Hosted stages: ${stages.join(",")}`); assert.match(page.body.toString(), /EMERALD/i);
        for (const asset of ["/app.js", "/style.css", "/brand.png", "/favicon.svg"])
          assert.equal((await raw(asset)).status, 200, `Hosted asset: ${asset}`);
        const account = fixture.accounts.find(a => a.email === "manager@local.invalid")!;
        const login = await raw("/api/login", {}, { email: account.email, password: account.password });
        assert.equal(login.status, 200); assert.match(login.headers["set-cookie"]![0], /; Secure/);
        const cookie = login.headers["set-cookie"]![0].split(";")[0];
        assert.equal((await raw("/api/shops", { Cookie: cookie })).status, 200);
        const result = await raw("/api/reports/activity/export?format=xlsx", { Cookie: cookie });
        assert.equal(result.status, 200); assert.equal(result.body.subarray(0, 2).toString(), "PK");
        assert.equal((await raw("/api/me", { Host: "hostile.invalid", Cookie: cookie })).status, 403);
      } finally {
        const exited = once(child, "exit"); child.kill(); await exited;
      }
    });
    await t.test("Separate import role imports a synthetic reviewed batch; runtime cannot write import metadata", async () => {
      const org = randomUUID();
      await ownerDb.query("INSERT INTO organizations(id,name) VALUES($1,$2)", [org, "Fictional import workspace"]);
      const managerId = await createAccount(ownerDb, org, "import-test@synthetic.invalid", "Fictional manager", "manager", "test-only-password-12345");
      const actor = { id: managerId, organizationId: org, name: "Fictional manager", role: "manager" as const };
      const batch = { sourceHash: "a".repeat(64), rows: [{kind:"lead",row:2,name:"Fictional lead",contact:"",phone:"",phoneType:"empty",whatsapp:"",whatsappType:"empty",area:"",emirate:"",country:"",zohoId:"",ownerId:null}] };
      await verifyRuntimeRole(importDb!);
      const imported = await importPilotBatch(importDb!, actor, batch);
      assert.equal(imported.leads, 1);
      assert.equal((await importPilotBatch(importDb!, actor, batch)).replay, true);
      await assert.rejects(() => runtimeDb.query("UPDATE import_batches SET status='rejected'"), (error: any) => error.code === "42501");
      for (const sql of ["DELETE FROM shops", "UPDATE audit_events SET action='changed'", "DELETE FROM schema_migrations", "CREATE TABLE unexpected_import(id int)"])
        await assert.rejects(() => importDb!.query(sql), (error: any) => error.code === "42501");
    });
    await t.test("Schema checksum drift blocks startup verification", async () => {
      await ownerDb.query("UPDATE schema_migrations SET sha256='changed' WHERE name=(SELECT min(name) FROM schema_migrations)");
      await assert.rejects(() => verifyMigrations(runtimeDb), /Schema verification failed/);
    });
  } finally {
    await importDb?.close(); await db?.close(); await owner?.close();
    await admin.pool.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.pool.query(`DROP ROLE IF EXISTS ${importer}`); await admin.pool.query(`DROP ROLE IF EXISTS ${runtime}`); await admin.pool.query(`DROP ROLE IF EXISTS ${operator}`);
    await admin.close();
  }
});
