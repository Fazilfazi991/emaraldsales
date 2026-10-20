# Emerald Field Sales CRM — reusable demo source

This is the faithful source snapshot of the Emerald Interlink Trading L.L.C **building-materials field sales / shop visit CRM**. The user reports that the client approved the demo and wants to develop a production CRM from it. That reported approval is context, not a signed specification or production acceptance.

This is separate from AquaFleet / the water transport CRM. The correct original demo URL path is `/demo/emerald-interlink`.

## Run locally

Requirements: a current browser with JavaScript enabled and Python 3 for this optional static server. The app itself needs **no npm install, framework build, API keys, database or environment variables**.

1. Extract the ZIP and open a terminal in the `emerald-field-sales-crm-source` directory.
2. Start a local server:

   ```sh
   python -m http.server 8080 --bind 127.0.0.1 --directory public
   ```

   On Windows, `py -3` may be used instead of `python` if that is your installed Python launcher. Leave the terminal running; Ctrl+C stops the server.
3. Open **http://127.0.0.1:8080/demo/emerald-interlink/** (the trailing slash serves `index.html`). Or use `/demo/emerald-interlink/index.html`.
4. Use a dedicated browser profile/port for this fictional-data demo. Changes are stored under `fusion-emerald-interlink-field-crm-v1` in that browser origin. Reset demo restores the fictional seed records and removes your local demo changes.

Opening the HTML using `file://` is less reliable for storage and geolocation. GPS is optional, depends on browser permission and a secure context such as supported localhost contexts or HTTPS, and its denial does not stop check-in. No external font download or map service is needed.

## Files

| Path | Purpose |
| --- | --- |
| `public/demo/emerald-interlink/index.html` | Original HTML, inline CSS, inline vanilla JavaScript, seed data and all five modules; unchanged bytes. |
| `public/demo/emerald-interlink/favicon.svg` | Only runtime asset referenced by the HTML; unchanged bytes. |
| `docs/original-requirements.md` | Original repository brief, copied unchanged; distinguish its narrative from tested implementation. |
| `reference-tests/original-acceptance.cjs` | Original Playwright test, copied unchanged as a reference; see caveats below. |
| `docs/DEMO-INVENTORY.md` | Actual demo behavior, dependencies, known issues and production gaps. |
| `docs/PROJECT-BACKGROUND.md` | Detailed uploadable context for a ChatGPT Project supervising production work. |
| `docs/CHATGPT-PROJECT-SUPERVISOR-PROMPT.md` | Separate copy-paste Project instructions. |
| `docs/SOURCE-PROVENANCE.md` | Source identity, commit, extraction decisions and working-tree caveat. |
| `VALIDATION.md`, `SHA256SUMS.txt` | Export checks and per-file SHA-256 integrity manifest. |

## Reuse and integration

The original portfolio is a larger Next.js site, but this demo is served directly from `public/`. None of its Next.js/React packages, APIs, global layout, Tailwind, Supabase configuration or other client folders are imported by this HTML. They are intentionally excluded.

To use in an existing Next.js project, copy the `public/demo/emerald-interlink` directory into its `public/` directory. `/demo/emerald-interlink/index.html` works as a static file. For the original extensionless URL, add this entry to your own `next.config.mjs` rewrites, merging with your existing configuration:

```js
{ source: '/demo/emerald-interlink', destination: '/demo/emerald-interlink/index.html' }
```

Other static hosts should serve that directory's index or configure the equivalent route. Keep the directory structure: the favicon reference is absolute at `/demo/emerald-interlink/favicon.svg`. Moving the app under another base path requires a deliberate asset-path change in your development copy. No behavior was refactored for this export.

For production, create a separate development repository/branch. Preserve this snapshot as a UI/workflow baseline. Deliberately separate presentation, data access and domain logic, then replace seed data, local storage, identity switching and browser-trusted event data with authenticated, authorized server behavior. Do not connect real customer data to the demo as delivered.

## Checks and reference test

See `VALIDATION.md` for checks actually run during this export. The reference acceptance test is **not a portable standalone test command**: it has an environment-specific Playwright path (override with `PLAYWRIGHT_MODULE`), expects Microsoft Edge, assumes the original website/card exists, and asserts a fixed September 2026 history date. Its default URL also expects the original rewrite. Adapt those assumptions in a separate development copy before using it as a regression suite. This export does not claim that the original full-site test passes here.

## Provenance

Source: `C:\Users\USER\Desktop\Projects\Fusion Ventures Website`, GitHub `Fazilfazi991/fusionwebsite`, branch `main`, HEAD `4fd5bf3b1d0822a7190b4b8f153349134985c06c`. Snapshot prepared 2026-10-20. Selected source files match HEAD; unrelated untracked files exist in the original working tree and were excluded. Read `docs/SOURCE-PROVENANCE.md` for details. No license file was found in the selected source set; confirm rights for production reuse and any later-added dependencies with the project owner.

No implementation, deployment, push, account change or production data change was performed.
