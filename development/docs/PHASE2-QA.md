# Phase 2 independent QA — 20 October 2026

Scope: local engineering acceptance using synthetic accounts and shops. No production deployment, real client import, production account creation or Zoho connection was performed.

## Independent automated acceptance

`tests/phase2-acceptance.test.ts` drives real HTTP sessions against an isolated, disk-backed PGlite database with 700 synthetic shops. It does not use the operational `.data` directory. Its nine scenarios are counted by Node as ten passing tests including the parent test; see `evidence/phase2/api-acceptance.tap`.

- Anonymous, CSRF, foreign-origin, manager-as-performer and spoofed-performer mutations are rejected server-side.
- Concurrent different-shop check-ins for the same executive produce one winner. Another executive can check in to the same shop with separate attribution and cannot complete the first executive's visit.
- Replaying an unacknowledged checkout with its original key returns the original result. A new request cannot overwrite completed history; existing follow-ups stay unchanged.
- Follow-up assignment, former-owner denial, concurrent reschedule version conflict and completion preserve an independent lifecycle.
- A forced failure after the transaction callback but before commit rolls back the visit, newly created follow-up, audit and idempotency entry together. Retrying the exact request succeeds.
- Repeated duty break/return intervals are recorded separately from visits. Another executive cannot read private duty history.
- Manager-only activity, duty and follow-up report routes and both download formats enforce authorization, person filters and validated dates. Native XLSX/PDF signatures are checked.
- Closing and reopening the database preserves completed visits, assigned/completed follow-ups and ended duty sessions.
- Logout revokes the existing cookie; disabling an account invalidates its session immediately.

This establishes local embedded-engine safety. It does not demonstrate contention across multiple external PostgreSQL connections or multiple application servers.

## Browser acceptance and usability review

`scripts/phase2-browser.ts` launches installed Microsoft Edge through Playwright against its own temporary database and uses genuine separate signed-in executive/manager accounts. It uses visible labels and buttons for normal operations; direct database queries independently verify saved state. API reads verify exported record totals.

The required widths are 390, 430, 768, 1024 and 1440 pixels. The final run records all assertions, page overflow measurements and download checks in `evidence/phase2/browser.json`.

Result: 16 browser checkpoints passed, 43 saved layout observations had no page-level horizontal overflow, 15 report downloads passed, and no uncaught browser errors were observed. Download checks include five direct exports using changed visible dates/person, five normal Excel downloads and five PDF downloads. These counts describe grouped browser checkpoints, not 16 independent unit tests.

| Width | Executive | Manager |
| --- | --- | --- |
| 390 | `executive-day-390.png`, `executive-saved-history-390.png` | `manager-overview-390.png`, `manager-followups-390.png` |
| 430 | `executive-day-430.png`, `executive-database-error-430.png` | `manager-overview-430.png`, `manager-duty-430.png` |
| 768 | `executive-day-768.png`, `executive-checkout-768.png` | `manager-overview-768.png`, `manager-one-executive-768.png` |
| 1024 | `executive-day-1024.png`, `executive-checkout-1024.png` | `manager-overview-1024.png`, `manager-duty-1024.png` |
| 1440 | `executive-day-1440.png`, `executive-checkout-1440.png` | `manager-overview-1440.png`, `manager-audited-transfer-1440.png` |

All screenshots and downloaded files are under `evidence/phase2`.

At each width, the executive journey covers login, start duty, break/return, shop search, check-in, outcome/notes checkout with follow-up, standalone follow-up creation, rescheduling, completion, end duty and logout. The manager journey covers today's attendance/completed/pending overview, pending follow-ups, one executive, Excel/PDF downloads, duty records and refresh. Extra 1440px checks cover discovery creation, manager assignment, explicitly confirmed shop transfer and visible attributable audit history.

Additional fault checks cover a server-committed checkout whose acknowledgement is lost at 390px and a failed database audit write at 430px. The former must replay exactly once; the latter must leave the visit open without a new follow-up and provide a successful retry. Refresh while two executives share a shop must retain the correct executive's checkout control. Untrusted visit notes must render as text.

Excel files are opened with ExcelJS to verify filtered executive names and complete record counts, including direct export after changing visible dates/person without first pressing Show activity. PDF downloads are genuine browser download events with native PDF signatures; PDF pagination/rendering review is separately recorded by the coordinator.

The initial review found follow-up actions buried beneath long mobile visit history. That was corrected by moving follow-ups ahead of the history on mobile and adding a clearly labelled jump link. Manager downloads were moved directly beneath the date/person filters, and explicit form labels were added. A tablet review also identified horizontally hidden report columns; the existing readable card layout was extended to tablet widths. Routine executive checkout now exposes outcome, a short discussion note and an optional follow-up date; order details remain optional.

These are scripted first-use-path and visual reviews by engineering, not independent research with first-time human CRM users. Owner/staff usability acceptance is still required.

## Runtime smoke test

`scripts/phase2-runtime.mjs` is limited to the authorized synthetic runtime at `http://127.0.0.1:3100`. It creates/revokes executive and manager sessions, reads policy/data, checks report-role enforcement, captures screenshots and verifies logout. It does not create visits, follow-ups, shops or duty events. Evidence: `evidence/phase2/runtime.json`.

The fresh runtime smoke passed for both roles. Supplementary 768px/1024px checks covered six internal table wrappers across executive visit history and manager staff/report cards. Their `clientWidth/scrollWidth` measured 538/538 and 794/794 respectively; every first-record cell remained inside its wrapper and displayed. These checks distinguish internal table visibility from the separate page-overflow measurements.

## Reproduce

Run from `development` after installing the pinned dependencies, preparing the client assets and keeping the operational database closed to these test harnesses:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
node scripts/build.mjs
.\node_modules\.bin\tsx.cmd --test tests/phase2-acceptance.test.ts
.\node_modules\.bin\tsx.cmd scripts/phase2-browser.ts
```

The browser harness requires installed Microsoft Edge. The optional runtime smoke requires the authorized synthetic server running on port 3100 and its existing `.local/accounts.json`; credentials are read locally and never included in screenshots, output or committed evidence.

## Practical limits and launch blockers

Local acceptance does not establish production readiness. External PostgreSQL operations/concurrency, hosting, TLS/session policy, backups and restore drills, production identity/account recovery, monitoring and staff acceptance still need an approved production plan. PDF currently refuses text outside its supported Latin character repertoire rather than exporting corrupt glyphs; Unicode customer names remain available through Excel. The owner must decide and validate the licensed Unicode PDF font/local-language requirements before launch.
