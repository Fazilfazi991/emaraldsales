# Phase 3 owner handoff — local demonstration candidate

20 October 2026. **Owner/client acceptance pending. No production operations authorized or performed.**

Branch: `phase3/owner-review`. Accepted base: `31402a8c24c296ee22f4a89599542d160b8f8f42`.

Verified implementation: **`dddeb42fd0e826eb83a9ebf9e618dc429b7e534e`**. A subsequent evidence-only delivery commit contains this handoff and the recorded results; use `git rev-parse HEAD` for the exact delivered snapshot. No main merge or push was performed.

## Completed improvements

- Search filter disclosures retain state; active conditions are counted and Clear filters resets search and selections.
- Executive/manager navigation uses Today/Overview, New shops and Team. The five existing destinations and permissions remain.
- Manager totals and staff appear before detailed reports. Mobile dates share a row, a report jump link is visible at the top, and KPI labels explain date-bound versus current work.
- PDF export embeds bundled SIL-OFL Noto fonts. Latin, Arabic and Malayalam use Chromium shaping, bidirectional ordering and font fallback. Unsupported characters get a useful Excel alternative, rather than silent missing glyphs.
- Excel/PDF show selected dates, selected staff even for empty exports, UAE generation time and relevant same-snapshot totals. Started visits and completed visits are labelled separately. Continued PDF pages retain context, headers and page numbers.
- Excel duty exports normalize every break into a Break history sheet with dynamic row heights. Very long PDF records split across pages without dropping data or leaving a header-only first page.
- A separate synthetic demonstration database, private random local credentials, 700 shops and multilingual examples are prepared. Original Phase 2 data remains separate.

Two independent reviewers assessed design and evidence/safety without seeing each other's initial conclusions. The coordinator implemented and integrated changes. The evidence reviewer independently confirmed the final export edge fixes. See [review and before/after comparisons](PHASE3-REVIEW.md).

## Executed verification

| Check | Result | Evidence |
|---|---|---|
| Accepted baseline automated reproduction | 52 passed, 0 failed | [TAP](../evidence/phase3/baseline-tests.tap) |
| Accepted baseline browser reproduction | 16 grouped checkpoints, 43 layout assertions, 15 native downloads, no uncaught errors | [Before JSON](../evidence/phase3/before/browser.json) |
| Frozen lockfile install and TypeScript/client build | Passed | Commands in README; final implementation commit above |
| Final domain/API/export/security suite | **56 reported tests passed, 0 failed**; includes four parent suite entries, 52 leaf tests | [TAP](../evidence/phase3/after-tests.tap) |
| Final isolated browser acceptance | **26 grouped checkpoints, 53 layout assertions, 35 native downloads**, no uncaught errors; 390/430/768/1024/1440px | [After JSON](../evidence/phase3/after/browser.json), [log](../evidence/phase3/after-browser.log) |
| Actual port-3100 demonstration | Separate executive/manager journeys, refresh and fresh-login persistence, five widths, **six populated native downloads** | [Runtime JSON](../evidence/phase3/demo/runtime.json), [log](../evidence/phase3/runtime.log) |
| Independent PDF/Excel edge review | 300 break markers retained across six PDF pages, data starts page one, repeated context; 120-character executive name has 88pt Excel row; sample dates/totals corrected | [Independent JSON](../evidence/phase3/independent-final.json) |
| Font bytes/license | Four pinned upstream font hashes and SIL-OFL license checked | Automated suite; [font manifest](../assets/fonts/manifest.json) |
| Production dependency audit | 0 known advisories at execution time | [Audit JSON](../evidence/phase3/dependency-audit.json) |
| Reference preservation | All 10 supplied manifest hashes match | [Integrity log](../evidence/phase3/reference-integrity.log) |
| UI heuristic detector | 0 initial / 0 post-change findings | review-detector.json and after-detector.json in evidence/phase3 |

Tests cover authentication/roles, organization isolation, server-authorized writes, invalid inputs, CSRF, immutable history/audit, races, repeated checkout, retry after lost acknowledgement, database-write rollback, repeated breaks, assignments/transfers, UAE midnight/overnight reporting and disk reopen. New PDF checks exercise embedded fonts, unsupported glyph errors, untrusted HTML/network isolation, concurrent preparation limits and slot recovery.

Browser journeys execute genuine UI actions through the local HTTP API and PostgreSQL data. At every width they cover executive login/duty/search/check-in/checkout/follow-up/breaks/end, fresh login, manager activity/person filters, follow-ups, duty and report downloads. Failure injection at 430px is intentional; its log entry is not an unresolved failed test. Excel record counts reconcile with filtered API totals, including all break rows. Native PDFs have valid signatures; representative Unicode, multi-page, empty, repeated-break and oversized outputs were extracted/rendered and inspected. We do not claim every downloaded PDF was individually visually inspected.

The earlier Latin-only implementation's shaping attempt exposed a Malayalam library failure; it was replaced with Chromium. A generated arrow in duty export was outside the new fonts' repertoire and was changed to plain “to”. The final suite and journeys passed after these fixes. No failed tests remain in the final run.

## Demonstration and screenshots

Application: **http://127.0.0.1:3100/**. The synthetic demo is left running. Use **Ahmed** (`ahmed@local.invalid`) and **Manager** (`manager@local.invalid`) in separate browser profiles. Passwords are private in `development/.local/phase3-demo-accounts.json`; they are not committed or printed in chat.

See [the two walkthroughs](PHASE3-DEMONSTRATION.md), [client checklist](PHASE3-ACCEPTANCE.md) and [run instructions](../README.md). `pnpm demo:start` opens the prepared database; `demo:prepare` is first-time-only and refuses to replace existing data. Run `pnpm pdf:setup` once on another machine before PDF use. The runtime acceptance script intentionally adds fictional demo activity on each run.

| View | Before | After / presentation |
|---|---|---|
| Manager mobile | [Before](../evidence/phase3/before/manager-overview-390.png) | [After](../evidence/phase3/after/manager-overview-390.png), [clean demo](../evidence/phase3/demo/manager-overview-390.png) |
| Manager desktop | [Before](../evidence/phase3/before/manager-overview-1440.png) | [After](../evidence/phase3/after/manager-overview-1440.png), [clean demo](../evidence/phase3/demo/manager-overview-1440.png) |
| Executive mobile | [Before](../evidence/phase3/before/executive-shop-390.png) | [After](../evidence/phase3/after/executive-shop-390.png), [checkout](../evidence/phase3/demo/executive-checkout-390.png) |
| Customer history desktop | Existing shared-history design preserved | [Clean demo](../evidence/phase3/demo/executive-history-1440.png) |
| Report output | Latin-only PDF previously rejected Arabic | [Unicode rendering](../evidence/phase3/reports/unicode-activity.png), [populated duty](../evidence/phase3/reports/repeated-break-duty.png) |

Further screenshots cover 430, 768 and 1024px in before/after/demo evidence directories. Regression screenshots can contain deliberate untrusted-text/error probes; use clean demo screenshots for presentation.

## Database and dependencies

**No Phase 3 migrations.** Existing `001_foundation.sql`, `002_import_provenance.sql`, `003_phase2_visits_and_shop_versions.sql` remain immutable and are applied to the new isolated demo database. No original history/ownership was rewritten. The multilingual fixture adjustments run only after seeding an empty synthetic database.

PDFKit is replaced by Playwright Chromium at runtime; fontkit validates font coverage, with four licensed font assets committed. Browser processes have JavaScript disabled, a restrictive CSP and network interception. Values are escaped; at most two PDFs prepare per process, with an understandable busy response and timeout. This is verified for the single-process local environment, not approved hosted capacity.

## Remaining usability and release blockers

No observed engineering defect blocks the scripted local demonstration. Remaining acceptance/launch requirements are explicit:

1. **First-time human/client acceptance and real-phone testing are pending.** Emulated widths do not prove physical keyboard, GPS permission/accuracy or phone download behavior.
2. **Language and terminology acceptance are pending.** A client speaker must approve Arabic/Malayalam names/layout and intended additional scripts. Unsupported scripts/emoji require additional licensed fonts. The mobile signed-in header retains the green identity but has no compact logo; this low-priority observation is documented for owner review.
3. **Reporting semantics and business corrections need client confirmation.** Started-versus-completed dates, current pending counts, duty boundaries, missed-event correction authority, shift/rest limits and lead conversion remain explicit policy items. Current safe behavior adds no silent correction or payroll inference.
4. **Hosted operation is unconfigured and unverified.** External PostgreSQL/concurrency, identity recovery/offboarding, secure hosting/cookies, backup/restore ownership, retention/privacy, monitoring and staging/load/recovery acceptance are release blockers. The local configuration intentionally refuses production mode.
5. **Production authority is absent.** No deployment, real-data import, production accounts, Zoho connection or main merge is authorized by this handoff.

The owner should execute [the acceptance checklist](PHASE3-ACCEPTANCE.md) and record the decision before a separate production planning/approval step.
