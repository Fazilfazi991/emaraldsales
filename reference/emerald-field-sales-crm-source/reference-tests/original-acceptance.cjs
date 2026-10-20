const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const BASE = process.env.EMERALD_DEMO_URL || "http://localhost:3035/demo/emerald-interlink";
const FOLLOW_UP = (() => { const d = new Date(); d.setDate(d.getDate() + 3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();

async function run() {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(9000);
  const errors = [];
  const watchErrors = tab => {
    tab.on("pageerror", error => errors.push(error.message));
    tab.on("console", message => { if (message.type() === "error") errors.push(`${message.location().url}: ${message.text()}`); });
    tab.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  };
  watchErrors(page);
  context.on("page", watchErrors);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Today’s field activity" }).waitFor();
  assert.equal(await page.locator(".nav button").count(), 5);
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.getByRole("button", { name: "Reset Demo Data", exact: true }).click();

  // Existing account: verify the 8-visit history, check in and complete visit nine.
  await page.getByRole("button", { name: "Shops", exact: true }).first().click();
  const search = page.getByRole("textbox", { name: "Search shops" });
  await search.fill("Al Noor Building Materials");
  await page.getByRole("button", { name: "Al Noor Building Materials", exact: true }).click();
  await page.getByText("8 total visits", { exact: true }).waitFor();
  assert.match(await page.locator(".visit-history").innerText(), /29 September 2026|29 Sep 2026/);
  await page.getByRole("button", { name: /Check in to this shop/ }).click();
  await page.getByText(/Checked in to Al Noor Building Materials/).waitFor();
  await page.getByRole("button", { name: /Check out/ }).click();
  const form = page.locator("#dialog form");
  await form.locator('[name="status"]').selectOption("Order Expected");
  await form.locator('[name="orderStatus"]').selectOption("Order Expected");
  await form.locator('[name="notes"]').fill("Customer needs new stock next week. Asked for the updated price on cement boards.");
  await form.locator('[name="orderNote"]').fill("Approximately 50 boards; confirm quantity next visit.");
  await form.locator('[name="orderValue"]').fill("4200");
  await form.locator('[name="followUpDate"]').fill(FOLLOW_UP);
  await page.getByRole("button", { name: "Check Out · Save Visit", exact: true }).click();
  await page.getByText("9 total visits", { exact: true }).waitFor();
  assert.match(await page.locator(".visit-history").innerText(), /Customer needs new stock next week/);

  // Manager sees the completed visit immediately in the daily activity and history.
  await page.locator("#salesperson").selectOption("manager");
  await page.getByRole("button", { name: "Dashboard", exact: true }).first().click();
  await page.getByRole("button", { name: "Al Noor Building Materials", exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Visits", exact: true }).first().click();
  await page.locator("[data-vfilter=when]").selectOption("today");
  await page.locator("[data-vfilter=person]").selectOption("ahmed");
  await page.getByRole("button", { name: "Al Noor Building Materials", exact: true }).waitFor();
  const visitCards = await page.locator(".mobile-cards tbody tr").count();
  assert.ok(visitCards >= 1);

  // Roadside discovery: save a new lead and start its first visit in the same flow.
  await page.locator("#salesperson").selectOption("ahmed");
  await page.getByRole("button", { name: "Leads", exact: true }).first().click();
  await page.getByRole("button", { name: "Add New Shop" }).click();
  const newShopForm = page.locator("#dialog form");
  await newShopForm.locator('[name="name"]').fill("Emerald Star Hardware");
  await newShopForm.locator('[name="contact"]').fill("Mohammed");
  await newShopForm.locator('[name="phone"]').fill("+971 50 555 0190");
  await newShopForm.locator('[name="area"]').selectOption("Al Quoz");
  await newShopForm.locator('[name="location"]').fill("Al Quoz Industrial Area 3, Dubai");
  await page.getByRole("button", { name: "Save & Check In", exact: true }).click();
  await page.getByRole("heading", { name: "Emerald Star Hardware" }).waitFor();
  await page.getByText("New Lead", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: /Check out/ }).click();
  await page.locator("#dialog form [name=status]").selectOption("New Opportunity");
  await page.locator("#dialog form [name=notes]").fill("New shop found while travelling. Mohammed asked for a visit to discuss building-board requirements.");
  await page.locator("#dialog form [name=followUpDate]").fill(FOLLOW_UP);
  await page.getByRole("button", { name: "Check Out · Save Visit", exact: true }).click();
  await page.getByText("1 total visits", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Dashboard", exact: true }).first().click();
  await page.getByRole("button", { name: "Emerald Star Hardware", exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Leads", exact: true }).first().click();
  await page.getByRole("button", { name: "Emerald Star Hardware", exact: true }).waitFor();

  // Persistence and all requested responsive widths.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Today’s field activity" }).waitFor();
  const persisted = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), "fusion-emerald-interlink-field-crm-v1");
  assert.ok(persisted.shops.some(shop => shop.name === "Emerald Star Hardware" && shop.lead));
  assert.ok(persisted.visits.some(visit => visit.notes.toLowerCase().includes("new shop found while travelling")));
  for (const width of [1440, 1366, 1024, 390]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 950 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal page overflow at ${width}px`);
    if (width < 700) {
      for (const view of ["dashboard", "shops", "visits", "leads", "team"]) {
        await page.locator(`#mobileNav [data-view="${view}"]`).click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal ${view} overflow at ${width}px`);
      }
      await page.locator('#mobileNav [data-view="shops"]').click();
      await page.getByRole("button", { name: "Add New Shop" }).waitFor();
    }
  }

  // Business Software portfolio card, SVG preview, and its live demo link.
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(new URL("/business-software", BASE).href, { waitUntil: "domcontentloaded" });
  const project = page.getByRole("heading", { name: "Emerald Field Sales CRM" });
  await project.scrollIntoViewIfNeeded();
  await project.waitFor();
  const preview = page.locator('img[alt*="Emerald Field Sales CRM"]');
  await preview.scrollIntoViewIfNeeded();
  await preview.waitFor();
  await preview.evaluate(img => img.decode());
  const previewStatus = await preview.evaluate(img => ({ complete: img.complete, width: img.naturalWidth }));
  assert.ok(previewStatus.complete && previewStatus.width > 0, "Portfolio dashboard preview loads");
  const [demoTab] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("link", { name: "Launch Field Sales CRM Demo" }).click()
  ]);
  await demoTab.getByRole("heading", { name: "Today’s field activity" }).waitFor();
  assert.ok(demoTab.url().endsWith("/demo/emerald-interlink"));

  assert.deepEqual(errors, [], `Unexpected browser console, resource, or page errors: ${errors.join("; ")}`);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: path.join(os.tmpdir(), "emerald-interlink-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(os.tmpdir(), "emerald-interlink-mobile.png"), fullPage: true });
  console.log("PASS: standalone demo and website card; 8-to-9 existing shop journey; new-shop lead and first visit; manager visibility; visit filters; browser persistence; desktop 1440/1366; tablet 1024; mobile 390; no browser errors. Screenshots: %s, %s", path.join(os.tmpdir(), "emerald-interlink-desktop.png"), path.join(os.tmpdir(), "emerald-interlink-mobile.png"));
  await browser.close();
}

run().catch(error => { console.error(error); process.exitCode = 1; });
