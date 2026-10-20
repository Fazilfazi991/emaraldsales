import { chromium } from "playwright";

export async function launchPdfBrowser() {
  if (process.env.VERCEL !== "1") return chromium.launch({ headless: true, timeout: 30000 });
  const [{ chromium: engine }, { default: binary }] = await Promise.all([
    import("playwright-core"), import("@sparticuz/chromium"),
  ]);
  // Pinned Chromium 153 / Playwright 1.63 pair. Binary is bundled; never fetched at runtime.
  return engine.launch({ headless: true, executablePath: await binary.executablePath(),
    args: binary.args, timeout: 30000 });
}
