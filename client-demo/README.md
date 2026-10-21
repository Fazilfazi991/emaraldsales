# Emerald Sales CRM — isolated client demo

This directory builds a static, fictional client-review site. It reuses the existing Emerald screens from `development/client` and substitutes `development/demo/transport.ts` at build time. The normal CRM build retains its authenticated server transport. No backend source, authorization rule or migration is changed by the demo.

## Run and verify

Use Node 22 and the pinned pnpm version:

```powershell
pnpm --dir client-demo install --frozen-lockfile
pnpm --dir client-demo build
cd development
pnpm build
pnpm test
node --import tsx scripts/demo-browser.ts
```

The browser verification script starts a disposable static file server, walks both roles and exports, checks five widths, and saves synthetic evidence in `development/evidence/client-demo`. Set `DEMO_BASE_URL` to the approved preview URL to run the same checks against HTTPS. It uses an empty browser context, without Vercel cookies or authentication bypass. It does not test a physical phone.

## Demo boundaries

- 700 fictional shops reuse the existing synthetic fixture names and areas, with Arabic and Malayalam examples. Initial records are deterministic relative to the UAE date when local data is first created/reset.
- Manager and three fictional executive profiles are role selections, **not secure authentication**. No passwords or staff accounts are provisioned.
- Changes are stored only in this browser's `localStorage` key `emerald-client-demo-v1`. They survive refresh and role switching. Different browsers, incognito sessions, devices and preview origins have independent copies. Closing an incognito session or clearing site storage removes changes.
- Reset Demo Data asks for confirmation, deletes only that demo key, and restores the samples. It never changes a backend database. Corrupt/blocked/full storage shows an error rather than claiming a successful save.
- Use fictional details only. No entered form details are uploaded. CSP disables network connections and form submissions; the bundle contains no real API transport. GPS, camera and microphone are disabled; sample check-ins do not request location. Sample telephone links are disabled.
- Native Excel files contain sample labels, selected dates/staff and totals. PDF is honestly labelled **Print / Save as PDF** and opens a print-ready view with bundled OFL-licensed Noto fonts. Choose Save as PDF in the browser print dialog. Popup permission may be needed. No hosted PDF service is used.
- This is a UI/workflow demonstration, not durable storage, shared-team access, tamper-resistant auditing, payroll or real-client acceptance. The backend remains the authority for a future real service.

## Vercel isolation

The dedicated project is `emerald-sales-client-demo` in `faziils-projects`; the existing `development` project and its aliases must not be edited. Use a **preview** deployment, Framework **Other** (`null`), Root Directory `client-demo`, output `dist`, Node 22 for the build, and include source files outside the root directory so the existing UI can be bundled. No functions or server entrypoints are deployed. Deploy only this static root, never the `development` Node application as a demo.

The project has no database/service integration, credentials or project environment variables. Public preview access is intentional for this synthetic client review only. Preview feedback is disabled. Git automatic deployments stay disabled; this does not authorize production promotion or changes to protection on other projects. A separate explicit preview deployment uses the reviewed demo branch/commit.

## Connect the real backend after client approval

Do not point the demo at production APIs or import browser-local records. Record client decisions, then separately approve the existing hosted staging/database plan, roles, TLS, secrets, migrations, synthetic seed, backups/restore and account recovery. Review the existing staging/runtime PRs independently. Build the normal `development` application with its default `client/transport.ts`, authenticated sessions and server authorization. Both builds use the same screen/forms contract, so no interface rewrite is needed. Verify real HTTPS workflows and reports before any approved real-data import or production promotion. The demo role selector and local adapter must never serve as real authentication or persistence.
