import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { hostedConfig } from "../src/hosted-config.js";
import { postgresPoolOptions } from "../src/postgres.js";
import { config } from "../src/config.js";
import { clientAddress } from "../src/server.js";
import vercelHandler from "../server.js";

const approved = { VERCEL: "1", NODE_ENV: "production", CRM_HOSTED_STAGE: "approved-synthetic-staging",
  APP_ORIGIN: "https://crm-staging.example.invalid", DATABASE_URL: "postgres://runtime@database.example.invalid/staging",
  VISIT_POLICY: "approved-v2", DUTY_POLICY: "approved-v1" };
test("Hosted startup requires approval, exact HTTPS origin and explicit policies before opening a connection", () => {
  for (const change of [{ CRM_HOSTED_STAGE: "" }, { VERCEL: "" }, { NODE_ENV: "development" },
    { APP_ORIGIN: "http://crm-staging.example.invalid" }, { APP_ORIGIN: "https://crm-staging.example.invalid/" },
    { APP_ORIGIN: "https://user:password@crm-staging.example.invalid" }, { APP_ORIGIN: "https://localhost" },
    { DATABASE_URL: "" }, { VISIT_POLICY: "approved-v1" }, { DUTY_POLICY: "pending" }])
    assert.throws(() => hostedConfig({ ...approved, ...change }));
  const result = hostedConfig(approved);
  assert.equal(result.app.secure, true);
  assert.equal(result.app.trustedProxy, "vercel");
  assert.equal(result.app.dataDir, "");
});
test("PostgreSQL TLS cannot be disabled by URL options or a remote test flag", () => {
  const base = { connectionString: approved.DATABASE_URL };
  assert.deepEqual(postgresPoolOptions(base).ssl, { rejectUnauthorized: true });
  assert.deepEqual(postgresPoolOptions({ connectionString: base.connectionString + "?sslmode=verify-full" }).ssl, { rejectUnauthorized: true });
  for (const option of ["sslmode=require", "sslmode=disable", "sslrootcert=ignored", "options=-c%20role=owner"])
    assert.throws(() => postgresPoolOptions({ connectionString: base.connectionString + "?" + option }));
  assert.throws(() => postgresPoolOptions({ ...base, localTest: true }));
  assert.throws(() => postgresPoolOptions({ ...base, max: 100 }));
});
test("Hosted PDF browser package contains the Linux binary and matches its Playwright major", async () => {
  const require = createRequire(import.meta.url);
  const binaryManifest = require.resolve("@sparticuz/chromium");
  const browserPackage = JSON.parse(await readFile(new URL("../package.json", pathToFileURL(binaryManifest)), "utf8"));
  const engineManifest = require.resolve("playwright-core/package.json");
  const { browsers } = JSON.parse(await readFile(new URL("./browsers.json", pathToFileURL(engineManifest)), "utf8"));
  assert.equal(browserPackage.version.split(".")[0], browsers.find((b: any) => b.name === "chromium").browserVersion.split(".")[0]);
  assert.ok((await stat(new URL("../bin/chromium.br", pathToFileURL(binaryManifest)))).size > 1000000);
});
test("Original production guard remains closed; proxy headers are trusted only in hosted settings", () => {
  const before = process.env.NODE_ENV;
  try { process.env.NODE_ENV = "production"; assert.throws(config, /Hosted production is not configured/); }
  finally { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before; }
  const settings = hostedConfig(approved).app;
  const request = { headers: { "x-vercel-forwarded-for": "203.0.113.11", "x-forwarded-for": "1.2.3.4" }, socket: { remoteAddress: "127.0.0.1" } } as unknown as IncomingMessage;
  assert.equal(clientAddress(request, settings), "203.0.113.11");
  assert.equal(clientAddress(request, { ...settings, trustedProxy: undefined }), "127.0.0.1");
  delete request.headers["x-vercel-forwarded-for"];
  assert.throws(() => clientAddress(request, settings));
});
test("Unapproved hosted requests return controlled no-store 503 without exposing configuration", async () => {
  // The test runner must never be used as a configured Vercel runtime.
  assert.notEqual(process.env.CRM_HOSTED_STAGE, "approved-synthetic-staging");
  const server = createServer(vercelHandler);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/`);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.error.code, "STAGING_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(body), /DATABASE_URL|postgres:|password|stack/i);
    const html = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/`, { headers: { Accept: "text/html" } });
    assert.equal(html.status, 503);
    assert.match(html.headers.get("content-type")!, /text\/html/);
    assert.match(await html.text(), /EMERALD INTERLINK/);
    const head = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/`, { method: "HEAD" });
    assert.equal(head.status, 503); assert.equal(await head.text(), "");
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
