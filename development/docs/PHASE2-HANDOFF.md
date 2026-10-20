# Phase 2 owner handoff — 20 October 2026

Status: locally integrated and engineering-verified candidate, using synthetic accounts/data only. **Not approved for production release.** The operational app is http://127.0.0.1:3100/ with `VISIT_POLICY=approved-v2` and the separately approved duty policy. Initial accepted commit was `ec26756`; work is on `phase2/integration`, with no production/main merge or remote push.

## Delivered by agent

| Owner / branch | Delivered | Original agent commits |
| --- | --- | --- |
| Backend / `phase2/backend` | One active visit per authenticated executive, simultaneous different executives at a shop, strict transactional ownership/retries; manager/admin versioned shop edits, explicit audited transfers and follow-up assignment; standalone follow-ups and shared attributable history; rollback regression tests | `ef4c2d68e5dc4a46664f7bfa856a8863b25779e9` |
| Mobile UX / `phase2/mobile` | Simple Your working day, large Search shops/visit actions, separate duty/break controls; short checkout and discovery forms; optional order detail collapsed; safe immutable Retry save; clear confirmations; own visit precedence; follow-ups above long history; readable tablet cards | `bf94780cc4b06f3aa8c1a0197d61e606dbd727bd`, `846ddd03e1f31e7e359f839d3dd44ed723dbdc7c`, `5d90c7cead7f6f0a8efe501222e5dfaedf4d3c14` |
| Manager / `phase2/manager` | Simple Daily activity default, current staff duty and date-wise recorded sessions/completed visits; pending/overdue follow-ups; date/person filters; report controls immediately below filters; downloads honor visible selections; validated UAE reporting and complete export snapshots | `cac18c7ac99d13e9580b3003cd8e2889e7cdbe18`, `c1c6e1a3aae5480fe695e8c96773fdefef1f41aa`, `5acf6d4599d74a003badfb86a8f0bed25a85829f` |
| Independent QA / `phase2/qa` | Independent API/fault/restart tests, actual browser flows and downloads at five widths, tablet cell visibility, screenshots, running-app smoke and usability findings sent back for fixes | `54c6049a1a8a626eda52f30704f0d8304405a516` |
| Coordinator / `phase2/integration` | Reverified baseline, explicit worktree/file ownership, reviewed/cherry-picked changes, protected Excel/PDF generation and download audit, default manager integration, backup/migration/activation, generated-file and PDF visual checks, current documentation and owner handoff | See integration commit inventory below |

Four simultaneous execution slots were available, so Backend/Mobile/Manager ran with the coordinator first; independent QA started after Backend finished. Follow-up fixes returned to the appropriate UI owner. Each agent committed only its assigned files in its isolated worktree. Working directories remain under `.worktrees/`; branches remain available for review.

Key integration commits: `7bf96e9` plan/ownership; `ecbb048` backend; `d5f2e24` reporting; `0d19dc1` protected downloads; `e64822a` mobile; `c588b19` manager default; `c03e381` PDF pagination; `380a798` follow-up reachability; `cc20fda` prominent downloads/labels; `cfbea45` visible-filter correctness; `fc1e2fa` tablet cards; `225b811` readable export columns; `12f1f20` independent QA. The final documentation/acceptance commit is shown by `git log -1 --oneline` and the owner-facing completion message.

## Current operational behavior

- Staff use real password sessions. Every operational API authenticates; sensitive writes enforce role, organization, ownership/version, CSRF and exact Origin on the server. No simulated identity or localStorage fallback was introduced.
- Each executive can have one open visit. Different executives can visit the same shop simultaneously, with separate IDs/timestamps/notes. Check-in and checkout use server timestamps. Checkout does not change assignment. Completed visits cannot be silently edited or checked out again.
- Executives discover shops with self-assignment. Managers/admins can edit shop details and explicitly transfer an existing shop with a reason, expected version, confirmation and audit. Transfer preserves prior visitors, creator and follow-up owners; shop status/conversion is not inferred from order interest.
- Follow-ups have independent pending/completed/cancelled lifecycles and versions. Checkout may create a new item; executives can also add one from their own completed visit. A manager/admin can assign a pending item to an active same-organization executive with reason/audit. Only the current executive owner completes/reschedules/cancels it. Later visits do not erase older items.
- Duty start, break, return and end are separate from visits, with private executive history and management team visibility. Exact instants, repeated breaks and overnight sessions are preserved. Return from break before ending duty; no payroll, absence, lateness or shift-duration rules are invented.
- Managers start on Daily activity. Visible date/person filters govern both screen and files; downloads can apply a changed visible selection directly. Reports provide current duty status, recorded sessions, completed checkouts, open visits and follow-up monitoring. Attendance means recorded duty events, not a guessed absence classification.
- Excel/PDF reports are manager/admin-only, scoped to the organization and filters, audited, and read every matching row in one snapshot. More than 10,000 matching rows returns a clear request to narrow the range. No successful file silently truncates at the screen page size. Customer accounting, general customer export and imports remain outside this release.
- Mobile and tablet reuse Emerald's existing cards/navigation. Follow-ups are reachable before long mobile history; optional filters/order detail stay out of the normal path. Failed or unacknowledged writes preserve an immutable attempt and offer Retry save. A server failure never becomes a successful-save message. Unsaved/unconfirmed drafts are not an offline sync system; after reload check authoritative history.

## Verification and acceptance

Checkpoint 1 freshly passed the strict build, all 21 reported foundation tests and all ten source manifest hashes at the accepted baseline. A real port-3100 manager session confirmed 700 shops, three executives, a pending visit gate and unauthorized-read denial. Evidence: `checkpoint1-foundation.tap`, `checkpoint1-runtime.json`.

Checkpoint 2 applied migration003 only after isolated backend/report verification. An offline backup was taken first. Before/after inventory both showed 700 shops, 96 visits, five follow-ups, five users, zero duty sessions and zero audit events; the assignment/creator/organization fingerprint was identical. Only the intended open-shop index/schema additions changed. The local gate was then activated to approved-v2. Reporting downloads subsequently add their own audit events; no real records were imported.

| Verification | Executed result and evidence |
| --- | --- |
| Strict TypeScript + browser bundle | Passed; `pnpm build` |
| Integrated automated suites | Foundation 21 + backend 11 + reports 8 + download serializer 2 + independent acceptance 10 = **52 reported tests**, including four parent groups; see `evidence/phase2/final-tests.tap` |
| Authorization/integrity | Anonymous, CSRF/Origin, spoofed actor, foreign organization, inactive/stale actor, cross-owner visits/follow-ups/duty and manager-as-performer denied; assignment/version/creator preservation, immutable audit and record history checked |
| Races/retries/database failures | One-executive concurrent check-ins, two executives same shop, duplicate/reused request keys, checkout races/repeated completion, assignment/reschedule conflicts, injected checkout/transfer/assignment/precommit failures and atomic retry verified |
| UAE dates and duty | Exclusive report-day end, midnight, leap/invalid dates, overnight visits and duty/rest, repeated breaks, ongoing clipped report times and explicit follow-up due dates verified |
| Persistence/recovery | Close/reopen and new authenticated sessions retain records; offline copied test database reopens; the actual runtime has a retained pre-migration offline backup |
| Independent browser | **16 grouped checkpoints passed** across **390, 430, 768, 1024, 1440px**; 43 saved page-layout observations without page overflow, **15 real downloads**, no uncaught browser errors; `browser.json` and `PHASE2-QA.md` |
| First-use paths | At every width: executive login → duty/break/return → shop search → check-in → discussion/checkout/follow-up → independent follow-up/reschedule/complete → end duty/logout. Manager: login → daily attendance/completed/pending → one executive/date → Excel/PDF → refresh. At 1440: discovery, explicit assignment and confirmed audited transfer |
| Uncertain/failed mobile save | At 390, server committed then acknowledgement was dropped; same-key retry yielded one result. At 430, an injected audit write failed; visit stayed open, no follow-up was added, form remained, Retry save succeeded |
| Tablet important fields | Actual runtime Visits/manager cards at 768/1024 had equal wrapper client/scroll widths (538/538 and 794/794), and all first-record cells were visible; `runtime.json` |
| Running application | Separate executive/manager session, approved-v2/duty policy, 700 shops, report role protection and logout smoke passed; `runtime.json` |
| Actual generated files | All six runtime Excel/PDF report kinds passed; workbook row counts reconcile with filtered API totals; `download-review.json`. Multi-page PDF has 96 extracted visit states across seven nonempty pages, every footer present; empty duty report is one page. All rendered pages reviewed; `pdf-visual-review.json` |
| Source reference | Supplied HTML hash and all ten manifest entries still match; `evidence/integrity.json` |
| Production dependency audit | Zero known advisories after pinning ExcelJS's transitive UUID to patched 11.1.1 in `pnpm-workspace.yaml`; final integrated tests and actual download checks rerun against that dependency set; `dependency-audit.json` |
| Human/client acceptance | **Not performed**. Scripted label-based first-use paths and engineering visual review do not establish acceptance by first-time staff users or field-device usability |

Usability findings fixed before handoff: buried follow-up actions, manager downloads below long staff lists, implicit field labels, visible-filter/download mismatch, important tablet columns offscreen, and blank PDF footer pages. Initial harness selector corrections were test-authoring issues; they are not represented as product defects. Final failed test count is zero; deliberately injected database errors are expected assertions.

Dependency review initially identified moderate advisory GHSA-w5hq-g745-h8pq in ExcelJS's UUID 8.3.2 dependency. ExcelJS uses its v4 interface; the targeted 11.1.1 override retains that interface and removes the advisory. No authentication or data permissions were relaxed. The final audit is an as-of check, not a security certification. The five-width browser run exercises the finished UI; the subsequent dependency-only patch is covered by the final integrated suite and running-app file checks.

## Screenshots to review

- [Executive mobile day](../evidence/phase2/executive-day-390.png), [short checkout](../evidence/phase2/executive-checkout-390.png), [safe retry](../evidence/phase2/executive-retry-390.png), [saved mobile history/follow-ups](../evidence/phase2/executive-saved-history-390.png).
- [Manager mobile overview](../evidence/phase2/manager-overview-390.png), [desktop overview](../evidence/phase2/manager-overview-1440.png), [follow-ups](../evidence/phase2/manager-followups-1440.png), [audited transfer](../evidence/phase2/manager-audited-transfer-1440.png).
- [Tablet executive](../evidence/phase2/runtime-ahmed-tablet-768.png), [tablet manager](../evidence/phase2/runtime-manager-tablet-768.png). Other required widths and report-download files are in `evidence/phase2`.

## Migration inventory, setup and rollback

| Migration | Purpose |
| --- | --- |
| 001_foundation.sql | Original relational identities, sessions, shops/visits/follow-ups, duty/rest, audit and idempotency foundation; unchanged |
| 002_import_provenance.sql | Organization-safe import provenance relation; unchanged, no import implementation/data |
| 003_phase2_visits_and_shop_versions.sql | Drop unique one-open-visit-per-shop index; add nonunique open-shop lookup; retain unique one-open-per-executive; add shop version/updated_at and audit-history index |

Startup requires migration003. Applied migration checksums are immutable. Current local data is `.data/crm`; pre-migration backup is `.local/backups/phase2-before-2026-10-20` (gitignored, sensitive). Scripts and migrations never reset the existing runtime. Use Node 22+ and pnpm 11.25.0. From `development` on a fresh empty environment:

```powershell
.\scripts\run.ps1 install --frozen-lockfile
Copy-Item -LiteralPath .env.example -Destination .env
.\scripts\run.ps1 build
.\scripts\run.ps1 db:migrate
.\scripts\run.ps1 db:seed --synthetic 700
.\scripts\run.ps1 dev
```

On this prepared checkout, just use the already running app; if stopped, `.\scripts\run.ps1 dev`. Do not overwrite an existing `.env`, rerun seed on a nonempty database or expose credentials in chat. Random synthetic login credentials remain in `.local/accounts.json`. Database CLI operations require the app stopped because the disk adapter permits one process per directory.

Verification: `.\scripts\run.ps1 build`, `.\scripts\run.ps1 test`, `.\scripts\run.ps1 test:browser`, `.\scripts\run.ps1 test:runtime`, `.\scripts\run.ps1 test:integrity`. Installed Edge is needed for browser tests; test:runtime expects port3100 and its local synthetic account file. Isolated tests do not modify the runtime database.

Rollback is a deliberate data/code operation, not a silent down migration. Stop the app; preserve the current directory and any post-activation writes; restore a **copy** of the retained pre-migration backup into a new data directory and run compatible Phase 1 code at `ec26756` in a separate checkout if reverting the policy/schema. Reconcile later records first. Recreating the old unique-shop index after multiple executives have open visits can fail, so never force-close/delete visits to make a downgrade fit. For forward repair, add a reviewed new migration. Do not copy a live directory or overwrite the only backup. The original general import/release plan remains in `MIGRATION-AND-RELEASE.md`.

## Unresolved choices and remaining launch blockers

The approved local core journeys have no pending permission gate. These still prevent a production-ready claim/release:

1. Select and authorize the actual staging/production database/hosting/region/domain. The current adapter is disk-backed embedded PGlite in one Node process; external PostgreSQL roles/pooling, multiple connections/application servers, capacity, operations and migrations on that target remain unverified. Loopback binding and production-mode refusal remain in place deliberately.
2. Specify real account onboarding/offboarding/recovery, password/session rotation, any MFA/SSO, HTTPS and secure cookies, operational monitoring/error response, backup/recovery targets and retention/privacy ownership. No production accounts or infrastructure were created.
3. Resolve missed duty/visit correction rules, exact cut-duty/shift/rest policy, lead conversion and final KPI acceptance. Existing completed history remains protected and unavailable correction/convert operations stay explicit. No payroll, absence or late rules are inferred.
4. Obtain client/customer import source, mapping, duplicate review and specifically authorized import target/commit. Staging/preview/dry-run/import commit tooling is still future work. The customer list here is synthetic; Zoho Books is unconnected.
5. Validate actual field devices, GPS success/denial/accuracy, flaky connectivity and first-time human executive/manager UAT. This is online-first; no offline synchronization is promised.
6. Decide supported report languages and a licensed Unicode PDF font. Excel retains Unicode; the current PDF renderer explicitly refuses unsupported scripts instead of delivering corrupt glyphs. Latin synthetic reports were rendered/inspected.

No deployment, real-data import, production account creation, Zoho connection, automatic production/main merge or production-readiness declaration occurred. The next owner step is a short synthetic-data staff/manager usability review using `UAT.md`, followed by decisions for the actual staging and account/correction operations.
