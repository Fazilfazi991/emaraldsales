import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { openDatabase, migrate } from "../src/database.js";
import { seedSynthetic, syntheticId } from "../src/fixtures.js";
import { application } from "../src/server.js";
import type { Config } from "../src/config.js";

// Isolated review harness: explicit proposed-policy configuration, never changes the operational database.
const temp = await mkdtemp(join(tmpdir(), "emerald-browser-")),
  db = await openDatabase(join(temp, "database"));
await migrate(db);
const fixture = await seedSynthetic(db, 700);
const config: Config = {
  host: "127.0.0.1",
  port: 0,
  origin: "http://127.0.0.1",
  dataDir: temp,
  secure: false,
  visitPolicy: "approved-v1",
  dutyPolicy: "approved-v1",
};
const server = application(db, config);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
config.origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const browser = await chromium.launch({ channel: "msedge", headless: true }),
  errors: string[] = [],
  checks: string[] = [],
  overflows: Row[] = [];
type Row = Record<string, unknown>;
const checkpoint = (name: string) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
await mkdir("evidence", { recursive: true });
async function signIn(context: BrowserContext, slug: string) {
  const account = fixture.accounts.find(
    (a) => a.email === `${slug}@local.invalid`,
  )!;
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      /Content Security Policy|Refused to/.test(m.text())
    )
      errors.push(m.text());
  });
  await page.goto(config.origin);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Today’s field activity", exact: true })
    .waitFor();
  return page;
}
async function navigate(page: Page, view: string, mobile = false) {
  await page
    .locator(`#${mobile ? "mobileNav" : "desktopNav"} [data-view="${view}"]`)
    .click();
  await page
    .locator("#crumb")
    .filter({
      hasText: (
        {
          dashboard: "Dashboard",
          shops: "Shops",
          visits: "Visits",
          leads: "Leads",
          team: "Sales Team",
        } as Record<string, string>
      )[view],
    })
    .waitFor();
}
async function searchShop(page: Page, name: string, mobile = false) {
  await navigate(page, "shops", mobile);
  await page.getByLabel("Search shops", { exact: true }).fill(name);
  await page.locator(".results").filter({ hasText: "1 shops" }).waitFor();
  await page.locator("[data-shop]").filter({ hasText: name }).first().click();
  await page
    .getByRole("heading", { name: "Shop profile", exact: true })
    .waitFor();
}
try {
  const execContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await signIn(execContext, "ahmed");
  checkpoint("real executive login and populated dashboard");
  assert.equal(await page.locator("#salesperson,#resetData").count(), 0);
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  for (const view of ["dashboard", "shops", "visits", "leads", "team"]) {
    await navigate(page, view);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    overflows.push({ view, width: 1440, overflow });
    assert.equal(overflow, false, `${view} desktop overflow`);
    await page.screenshot({
      path: `evidence/development-${view}-1440.png`,
      fullPage: true,
    });
  }
  await searchShop(page, "Al Noor Building Materials");
  assert.equal(await page.locator(".visit-record").count(), 8);
  await page.getByRole("button", { name: "Check in to this shop" }).click();
  await page.getByRole("button", { name: "Check out", exact: false }).waitFor();
  checkpoint("shared history to check-in with GPS unavailable/denied");
  await page.getByRole("button", { name: "Check out", exact: false }).click();
  const discussion =
    'Browser-to-PostgreSQL verification: <img src=x onerror="window.xssExecuted=true"> customer requested cement board information.';
  await page.getByLabel("Discussion / visit notes").fill(discussion);
  await page.getByLabel("New follow-up date").fill("2099-01-15");
  await page.getByLabel("Approximate order value").fill("3700");
  await page.screenshot({
    path: "evidence/development-checkout-1440.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Check Out · Save Visit", exact: true })
    .click();
  await page.locator("#dialog").waitFor({ state: "hidden" });
  await page.locator(".visit-record").filter({ hasText: discussion }).waitFor();
  assert.equal(await page.locator(".visit-record").count(), 9);
  assert.equal(
    await page.evaluate(() => Boolean((window as any).xssExecuted)),
    false,
  );
  assert.equal(await page.locator(".visit-record img").count(), 0);
  await page.screenshot({
    path: "evidence/development-shop-history-1440.png",
    fullPage: true,
  });
  checkpoint("checkout/follow-up stored and untrusted notes render as text");
  const saved = (
    await db.query<Record<string, any>>(
      "SELECT * FROM visits WHERE shop_id=$1 ORDER BY checked_in_at DESC LIMIT 1",
      [syntheticId("shop-1")],
    )
  ).rows[0];
  assert.equal(saved.notes, discussion);
  assert.equal(saved.lifecycle, "completed");
  const shop = (
    await db.query<Record<string, any>>("SELECT * FROM shops WHERE id=$1", [
      syntheticId("shop-1"),
    ])
  ).rows[0];
  assert.equal(
    shop.assigned_executive_id,
    fixture.accounts.find((a) => a.email === "ahmed@local.invalid")!.id,
  );
  await page.reload();
  await page.getByRole("heading", { name: "Today’s field activity" }).waitFor();
  await searchShop(page, "Al Noor Building Materials");
  await page.locator(".visit-record").filter({ hasText: discussion }).waitFor();
  checkpoint("persistence after browser reload");
  const managerContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    manager = await signIn(managerContext, "manager");
  await searchShop(manager, "Al Noor Building Materials");
  await manager
    .locator(".visit-record")
    .filter({ hasText: discussion })
    .waitFor();
  assert.equal(
    await manager.locator("[data-checkin],[data-checkout]").count(),
    0,
  );
  checkpoint("second authenticated manager session sees shared saved visit");
  const denied = await manager.evaluate(async (id) => {
    const me = await (await fetch("/api/me")).json();
    const r = await fetch("/api/visits/" + id + "/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": me.csrf,
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        outcome: "Regular Visit",
        notes: "Manager attempt",
        orderStatus: "No Order",
      }),
    });
    return r.status;
  }, saved.id);
  assert.equal(denied, 403);
  checkpoint("manager write attempt rejected by server");
  await manager.screenshot({
    path: "evidence/development-manager-history-1440.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of ["dashboard", "shops", "visits", "leads", "team"]) {
    await navigate(page, view, true);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    overflows.push({ view, width: 390, overflow });
    assert.equal(overflow, false, `${view} mobile overflow`);
    await page.screenshot({
      path: `evidence/development-${view}-390.png`,
      fullPage: true,
    });
  }
  await navigate(page, "dashboard", true);
  await page.getByRole("button", { name: "Start duty", exact: true }).click();
  await page.getByRole("button", { name: "Start rest", exact: true }).waitFor();
  await page.getByRole("button", { name: "Start rest", exact: true }).click();
  await page
    .getByRole("button", { name: "Return to duty", exact: true })
    .waitFor();
  await page.screenshot({
    path: "evidence/development-duty-rest-390.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Return to duty", exact: true })
    .click();
  await page.getByRole("button", { name: "End duty", exact: true }).waitFor();
  await page.getByRole("button", { name: "End duty", exact: true }).click();
  await page.getByRole("button", { name: "Start duty", exact: true }).waitFor();
  checkpoint("mobile executive duty start/rest/return/end");
  await navigate(page, "shops", true);
  await page
    .getByRole("button", { name: "Add New Shop", exact: false })
    .click();
  await page
    .getByLabel("Shop name", { exact: false })
    .fill("Mobile Synthetic Discovery");
  await page
    .getByLabel("Contact person", { exact: true })
    .fill("Synthetic contact");
  await page.getByLabel("Area", { exact: false }).last().fill("Al Quoz");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "evidence/development-new-shop-390.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Save & Check In", exact: true })
    .click();
  await page.locator("#dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("heading", { name: "Mobile Synthetic Discovery", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Check out", exact: false }).click();
  await page
    .getByLabel("Discussion / visit notes")
    .fill("Mobile field visit completed.");
  await page.screenshot({
    path: "evidence/development-checkout-390.png",
    fullPage: true,
  });
  // Simulate lost acknowledgement after the server has committed. Preserve the form and key for retry.
  let capturedKey: string | undefined;
  await page.route(
    "**/api/visits/*/checkout",
    async (route) => {
      capturedKey = route.request().headers()["idempotency-key"];
      await route.fetch();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Check Out · Save Visit", exact: true })
    .click();
  await page
    .locator("#saveErrorDialog")
    .filter({ hasText: "Save is unconfirmed" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Discussion / visit notes").inputValue(),
    "Mobile field visit completed.",
  );
  let retryKey: string | undefined;
  page.once("request", (req) => {
    if (req.url().includes("/checkout"))
      retryKey = req.headers()["idempotency-key"];
  });
  await page
    .getByRole("button", { name: "Check Out · Save Visit", exact: true })
    .click();
  await page.locator("#dialog").waitFor({ state: "hidden" });
  assert.equal(retryKey, capturedKey);
  assert.equal(await page.locator(".visit-record").count(), 1);
  checkpoint(
    "mobile lead save/check-in, checkout, lost-acknowledgement retry retains one visit",
  );
  await page.reload();
  await page.getByRole("heading", { name: "Today’s field activity" }).waitFor();
  await searchShop(page, "Mobile Synthetic Discovery", true);
  await page
    .locator(".visit-record")
    .filter({ hasText: "Mobile field visit completed." })
    .waitFor();
  checkpoint(
    "mobile reload persistence and all five modules without page overflow",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("heading", { name: "Sign in to your workspace" })
    .waitFor();
  assert.equal(
    await page.evaluate(async () => (await fetch("/api/shops")).status),
    401,
  );
  checkpoint("logout revokes server session");
  assert.deepEqual(errors, []);
  checkpoint("no browser page exceptions or CSP violations");
  await writeFile(
    "evidence/browser.json",
    JSON.stringify(
      {
        status: "passed",
        executedAt: new Date().toISOString(),
        browser: "Installed Microsoft Edge via Playwright",
        configuration:
          "Isolated temporary PostgreSQL database; explicit approved-v1 test policies",
        checks,
        overflows,
        errors,
        clientAcceptance: "not performed",
      },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    "evidence/browser.json",
    JSON.stringify(
      { status: "failed", checks, overflows, errors, failure: String(error) },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
  await db.close();
  await rm(temp, { recursive: true, force: true });
}
