# Final client-demo feature audit

Audit scope: isolated static Emerald client demonstration, fictional browser-local data only. This document distinguishes executed browser evidence from code review. It does not certify secure authentication, shared storage, real employee attendance, production readiness or client acceptance.

## Evidence and method

Independent browser harness: `development/scripts/attendance-browser.ts`. It serves only built static files locally, or targets the explicitly approved isolated Preview through `DEMO_BASE_URL`. It records requests, failed assets, browser console errors, downloaded workbooks and genuine Chromium print PDFs. Separate synthetic timestamp fixtures exercise past days, multiple sessions and overnight clipping without changing the application's clock. Fresh anonymous contexts check role selection and device/browser isolation. Existing client-demo evidence is preserved.

Integrated local acceptance passed. Results: **28 full-journey browser checkpoints plus one targeted final-build Team-clock regression**, six reopened Excel workbooks, six genuine Chromium PDFs, and zero unexpected API/external requests, failed asset responses or browser errors. TypeScript no-emit check passed. Screens were checked at 390, 430, 768, 1024 and 1440px. Public HTTPS verification is recorded separately after the isolated Preview is deployed; local results do not claim hosted acceptance.

## Five navigation destinations

| Destination | Essential controls audited | Initial code review | Integrated browser result |
| --- | --- | --- | --- |
| Today / Overview | Executive duty, hours, next visit, follow-ups; manager attendance, date/person filters, reports | Existing daily actions present; attendance hours missing before this change | Working — executed local browser evidence |
| Shops | Search, optional filters, pagination, shop profile/history, check-in, new shop | Present | Working — executed local browser evidence |
| Visits | Saved visit list, search, person/area/outcome/date filters, open shop | Present | Working — executed local browser evidence |
| New shops | Discoveries, search/filter, Add New Shop, first visit | Present; save opens the new profile for check-in | Working — executed local browser evidence |
| Team | Three fictional executives, per-person activity, permitted duty history | Present; executive sees only their own duty records | Working — executed local browser evidence |

## Executive workflow inventory

| Capability | Status before changes | Final status / evidence |
| --- | --- | --- |
| Choose role and enter workspace without password | Present | Working — executed local browser evidence |
| Duty start / break / return / end independent from shop visits | Present | Working — executed local browser evidence |
| Working hours directly on Today | Missing | Working — executed local browser evidence |
| Previous sessions and individual breaks | Session history present; break/return timestamps present | Working — executed local browser evidence |
| Multiple sessions and multiple breaks | Local transitions present | Working — executed local browser evidence |
| Search and open customer history | Present | Working — executed local browser evidence |
| Check-in, notes, outcome, optional order details, checkout | Present | Working — executed local browser evidence |
| New independent follow-up, reschedule, complete, cancel | Present | Working — executed local browser evidence |
| Add shop and perform its first visit | Present | Working — executed local browser evidence |
| Refresh and switch roles retain the same local records | Present | Working — executed local browser evidence |
| Reset Demo Data with confirmation | Present | Working — executed local browser evidence |

## Manager workflow inventory

| Capability | Status before changes | Final status / evidence |
| --- | --- | --- |
| Three executives visible in default overview | Present | Working — executed local browser evidence |
| Attendance status, first start, last end, duty, breaks, net hours and completed visits | Incomplete: live status and session count only | Working — executed local browser evidence |
| Person detail with individual duty and break/return timestamps | Duty report present; direct per-person attendance detail missing | Working — executed local browser evidence |
| Past-date status derived from selected saved sessions | Incomplete: original view labelled live duty status | Working — executed local browser evidence |
| No-record status without assuming absence | Missing daily attendance summary | Working — executed local browser evidence |
| Simple date/range/person filter | Present | Working — executed local browser evidence |
| Visit and pending/overdue follow-up reports | Present | Working — executed local browser evidence |
| Shop history and reasoned assignment transfer | Present | Working — executed local browser evidence |
| Edit shop / assign follow-up with reason and retained history | Present | Working — executed local browser evidence |
| Visits, duty/breaks and follow-up Excel / print | Present | Working — executed local browser evidence |
| Staff Attendance & Working Hours Excel / print with daily summary and detail | Missing | Working — executed local browser evidence |

## Usability and integrity review

The original Emerald branding, green/gold visual identity, five navigation destinations and short visit/shop forms are retained. Normal saves use visible confirmation messages. Destructive cancellation, transfer and reset require confirmation. Optional order details and advanced shop management remain collapsed. Browser-local limitations are visible at role selection and in the workspace; fictional phone links are disabled. The demo adapter retains existing validators, record versions, idempotent retries and explicit assignment history. These local demonstrations are browser-editable and do not substitute for backend security.

Initial confirmed gaps, now resolved and browser verified: no executive hour totals, no manager hour summary, no direct per-person attendance detail, no dedicated daily attendance report, and historical report status conflated with current status. No further blocking demo bug was confirmed in the integrated local audit. Shop area/status choice lists and optional order fields were reviewed in code; the essential short-form visit journey, person/date/status filters, confirmations and report actions were executed. This distinction avoids claiming exhaustive testing of every optional choice.

## Executed evidence

- [Browser checkpoints and network/error inventory](../development/evidence/attendance-review/local/verification.json).
- [Executive Today at 390px](../development/evidence/attendance-review/local/executive-390.png), [short visit form](../development/evidence/attendance-review/local/executive-visit-form-390.png), [shared shop history](../development/evidence/attendance-review/local/executive-shop-history-390.png).
- [Manager attendance at 1440px](../development/evidence/attendance-review/local/manager-attendance-1440.png), [390px staff cards](../development/evidence/attendance-review/local/manager-attendance-390.png), [individual session and break detail](../development/evidence/attendance-review/local/manager-ahmed-session-detail-1440.png).
- [Initial three distinct statuses](../development/evidence/attendance-review/local/manager-three-statuses-390.png), [past-date records versus current status](../development/evidence/attendance-review/local/manager-recorded-fixture-390.png).
- [Attendance Excel with four sections](../development/evidence/attendance-review/local/recorded-fixture-attendance.xlsx), [matching two-page PDF](../development/evidence/attendance-review/local/recorded-fixture-attendance.pdf), [overnight range Excel](../development/evidence/attendance-review/local/overnight-range-attendance.xlsx), [overnight range PDF](../development/evidence/attendance-review/local/overnight-range-attendance.pdf).
- [PDF text/font inspection](../development/evidence/attendance-review/local/pdf-inspection.json), [rendered attendance page 1](../development/evidence/attendance-review/local/recorded-fixture-attendance-render-1.png), [page 2](../development/evidence/attendance-review/local/recorded-fixture-attendance-render-2.png), [rendered multilingual visit report](../development/evidence/attendance-review/local/sample-activity-render-1.png).

All ten role/navigation combinations were opened and captured at 390px. Executive and manager overviews have screenshots at all five required widths; neither produced horizontal page overflow. Manager attendance collapses into readable cards on narrow screens. Report pagination, invalid date feedback, Retry and Today recovery were exercised in a separate fixture context.

The test-only recorded fixture gives Ahmed two ended sessions (09:00–13:00 and 14:00–17:00) and three breaks (15, 30 and 10 minutes): **7h 0m duty − 0h 55m breaks = 6h 5m net**. Shihab's actual saved overnight session is 23:00–02:00 with a 23:45–00:15 break: the second UAE date counts **2h 0m − 0h 15m = 1h 45m**; the complete range counts **3h 0m − 0h 30m = 2h 30m**. Manager rows, daily Excel rows, section row counts and print text reconcile. Naseer has no selected-day record and a separate current sample status of On break. The fixture changes only its isolated browser's synthetic saved records, without clock simulation or application time manipulation.

All six PDFs reopen with embedded fonts. The activity PDF contains embedded Noto Latin, Arabic and Malayalam subsets, and corresponding extracted characters. Poppler render review found readable multilingual names and attendance summary/detail pages without clipping. Native phone print dialogs and physical printers were not tested.

Two additional, explicitly isolated regression contexts use Playwright's fixed test clock across UAE midnight. They prove that open duty-history durations recalculate from saved timestamps, an open follow-up form updates its earliest allowed date without losing the form, Today refreshes after the dialog closes, and the manager retains selected person/dates while historical/current status labels refresh. The Today shortcut then selects the new UAE date. This emulation is confined to the test harness; the main acceptance journey and recorded-fixture reconciliation use the actual application clock. No clock simulation or artificial elapsed-time counter was added to the shipped application.

The final small UI correction also refreshes duty-duration cells on the executive Team screen, which has history without a Today duty card. A [targeted final-build regression](../development/evidence/attendance-review/local/team-clock-verification.json) passed: saved 11:00 duty start at test clock 12:00 displays 1h 0m, then the real timer callback recalculates 1h 1m when the isolated test clock reads 12:01. [Team history evidence](../development/evidence/attendance-review/local/clock-regression-team-history.png). The full harness includes this case for the subsequent HTTPS rerun; the local full journey records 28 checks and this separate final-build check adds one.

## Not implemented / client policy confirmation required

- Forgotten checkout, wrong customer, historical duty corrections and missed break return: historical records are not silently rewritten. Client must approve a correction workflow before real operations.
- Overtime, salary, paid breaks, lateness, absence, shift scheduling and payroll deductions: deliberately not inferred or implemented.
- GPS surveillance, real account authentication, shared database storage, backups and multi-device synchronization: outside this static-demo scope. Device/browser changes do not synchronize.
- Physical Android/iPhone testing, human first-time-user feedback and client acceptance: pending actual testers; Chromium viewport/touch emulation is not physical-device evidence.
- Production backend/staging approvals remain separate. No database, external services, real data or real employee accounts are needed or connected for this demonstration.

## Client feedback checklist

- Can a first-time salesman find duty actions and today's net hours immediately?
- Can they find a shop, check in, save a short outcome and finish the visit without instruction?
- Can they add/complete a follow-up and start the first visit to a new shop?
- Can the manager see every executive's selected-day duty status, breaks, hours and completed visits?
- Is it clear that a selected historical status differs from duty now?
- Can the manager open one executive's timings, filter dates/person and download attendance Excel or print?
- Are Arabic/Malayalam sample names readable on the real phones and in saved reports?
- Does everyone understand this browser-only demo, its reset behavior and lack of device synchronization?

Stop for owner visual approval before treating this preview as ready to share with the client.
