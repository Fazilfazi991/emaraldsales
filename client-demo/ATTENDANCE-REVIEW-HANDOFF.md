# Attendance client-demo owner review

21 October 2026, Asia/Dubai. **Owner visual approval is pending. This is not client acceptance or production readiness.**

## Scope and source

The isolated branch `demo/attendance-review` starts at `d915ebeb90c6d40fd33e6fb7bd8aad1211e9b100` on `demo/client-review`. The previous public preview was independently checked as READY, Preview, deployment `dpl_DjaAySGG3JEsaJo4n8tR5oy6qd93`, deployed source `3c2e7e613e123e82ec198f61aa2fd60294fe6db7`. Its later handoff commit did not change the application.

The new preview URL, deployed application SHA and final public verification are recorded below after publication. Publication is restricted to the existing `emerald-sales-client-demo` project, team `faziils-projects`, as an isolated static Preview. The original `development` project, its aliases, `main`, backend and staging branches are preserved.

| Contributor | Separate ownership and review |
| --- | --- |
| Attendance agent | Demo calculation, local store/report data and attendance tests; reviewed date boundaries and coordinator integration |
| Reports agent | Demo Excel/print formatting, print CSS and export tests; cross-reviewed midnight and overlapping records |
| Independent QA agent | Browser harness, synthetic evidence and feature audit; no application feature edits |
| Coordinator | Demo-gated executive/manager UI, transport contract, style integration, final review, source scans, publication and owner handoff |

All work used the single isolated branch with explicit file ownership. No agent overwrote another agent's owned code. Regular backend source and migrations were not changed. Local run and repeat-verification commands are in [README.md](README.md).

## Completed changes

- Executive Today shows total duty, break time and net working hours, beside the existing four duty actions. Duty history shows previous sessions and each break/return. Running values are recalculated from actual saved timestamps; no accelerated counters or artificial elapsed time are used.
- Manager Overview shows all three fictional executives with selected-date attendance, first actual start, last recorded end, duty, breaks, net hours and completed visits. One executive-name button opens that person's sessions and individual breaks. Narrow screens use readable cards.
- Staff Attendance & Working Hours adds daily rows, staff totals, original session times and individual break/return detail. Date/person filters apply to the screen, Excel and print. All exports say DEMO — Sample Data. Existing visit, duty and follow-up exports remain available; duty durations now use hours and minutes.
- A shared demo-only attendance calculation supports repeated sessions/breaks, ongoing sessions and UAE midnight. It retains exact milliseconds, clips counted intervals to the selected dates, then displays completed minutes. Original timestamps remain intact. An overlap warning explains union totals if legacy browser records overlap; the application does not silently rewrite them.
- Historical attendance uses recorded sessions for the selected dates. Current sample status is separate. A day without a session says No duty recorded, never Absent. Exact-midnight endings, open-screen date rollover and live executive history values were corrected during review.
- The original Emerald interface, five navigation destinations, short forms and saved-state feedback remain. No new database schema, migrations, infrastructure, payroll, shifts or correction policy was introduced.

## Verification

The normal CRM TypeScript/client build and static demo build passed. The complete regular suite passed **90/90**, zero failures, cancellations or skipped tests. This includes existing backend/domain/security regressions and focused attendance/export cases. No hosted database integration was attempted or claimed.

Independent browser evidence and a complete capability inventory are in [FEATURE-AUDIT.md](FEATURE-AUDIT.md) and `development/evidence/attendance-review/`. The browser harness exercises real button saves separately from fixed saved-timestamp calculation fixtures and isolated clock-rollover probes. It reopens downloaded workbooks and creates genuine Chromium PDF samples. Screenshot, PDF rendering/font and public-network results are recorded with those executions.

The required 390, 430, 768, 1024 and 1440px layouts are included. Chromium touch/viewport emulation is not a physical Android/iPhone test. Human first-time-user feedback, real phones, physical printing and owner/client approval remain pending.

Final local execution passed **28 browser checkpoints**, six downloaded workbooks reopened and six genuine browser-generated PDFs. Exact fixtures reconciled Ahmed's two sessions at 7h duty / 55m breaks / 6h 5m net, and Shihab's overnight selected day at 2h / 15m / 1h 45m, with the full range at 3h / 30m / 2h 30m. Separate regression contexts confirmed live history advances and UAE midnight refresh preserves open forms and manager filters. There were zero API/external requests, failed assets, browser console or uncaught errors. These are executed synthetic tests, not human acceptance.

## Nine-step owner walkthrough

1. Open the new preview in one browser; choose Sales Executive · Ahmed Hassan. Confirm the sample-data and browser-only labels.
2. Select Start duty. Today's hours are immediately visible. A quick demonstration may correctly remain `0h 0m` until a whole minute has elapsed.
3. Select Search shops, find Al Noor, open its history and Check in. Complete the visit with a short fictional discussion and outcome. Set a follow-up when needed.
4. Return to Today, Start break, then Return to duty. End duty. Open Duty history to review the saved session and both break timestamps.
5. Select Switch role, then Manager in the same browser. Ahmed's saved activity is shared between these sample roles.
6. Review all three executives' attendance, breaks, working hours and completed visits directly on Overview. Select Ahmed to open session detail.
7. Select a date or range and sales executive, then Show activity. For an overnight session, counted hours belong only to the selected UAE dates; actual start/end dates remain visible.
8. Select Visits or Follow-ups to review saved shop activity and pending items. Open a shop to see full history. A new visit never silently erases a follow-up or transfers assignment.
9. Select Staff attendance, then Excel or Print / Save as PDF. Allow the report popup if the browser blocks it. Verify selected dates, staff name and totals. Reset Demo Data restores the original fictional samples after confirmation.

## Client decisions and limits

| Decision | Safe behavior in this demo | Approval needed before real use |
| --- | --- | --- |
| Forgotten checkout / wrong customer | Original visit history retained; no historical correction control added | Authorized reasoned correction process and audit requirements |
| Incorrect duty time / missed break return | Saved timestamps retained; ongoing time continues from those records | Who can propose/approve corrections, with original values preserved |
| Overnight duty | Actual continuous session retained; reports split counted time at UAE midnight | Confirm this reporting presentation; no shift/payroll assumptions |
| No session / lateness / paid breaks / overtime | No duty recorded; net excludes recorded breaks; no payroll inference | Explicit attendance and compensation policy, separately scoped |
| Follow-up rescheduling / customer transfer | Existing explicit versioned actions and reasons/history retained | Human confirmation that labels, responsibility and assignment process suit the business |
| Live shared staff monitoring | Same-browser fictional records only; manager reports show refresh time | Separate secure staging/database/account and hosted acceptance approvals |

Feedback checklist: can a first-time executive find each duty action, today's hours, shop search and visit save without instructions? Can the manager find every executive, distinguish selected-date attendance from current status, inspect breaks and download a report? Are labels, mobile cards and Arabic/Malayalam names readable on actual phones? Record tester, device, date, result and any confusing step before approval.

## Storage and release boundary

**No Supabase, external PostgreSQL, backend service, real employee account, hosted secret, real customer import, GPS or Zoho connection was created or connected for the demo.** No backend authentication/authorization or production guard was weakened. The normal build retains its authenticated API transport; only the static demo aliases that transport to browser-local synthetic storage. The demo CSP blocks network connections (`connect-src 'none'`) and external form submissions.

Role switching and refresh reuse `emerald-client-demo-v1` in this browser and origin. Other devices, browsers, incognito contexts and preview URLs have independent copies. Clearing storage or closing incognito sessions can discard changes. This is neither multi-device synchronization nor real-time employee monitoring. Use fictional information only.

Remote branch and Vercel-project preservation, secret scans, exact publication SHA and final preview checks will be recorded in the publication section. Do not merge into main, promote a deployment or start real operations from this review.

## Publication and owner checkpoint

Source is pushed at [application commit `6b3ffc9606971a6f2c2389c03053d3b5ed33a30a`](https://github.com/Fazilfazi991/emaraldsales/commit/6b3ffc9606971a6f2c2389c03053d3b5ed33a30a) on [demo/attendance-review](https://github.com/Fazilfazi991/emaraldsales/tree/demo/attendance-review).

The new [owner-review Preview](https://emerald-sales-client-demo-euswu9jl0-faziils-projects.vercel.app) is READY: deployment `dpl_6HFfeixQFke1CRTpj9cxtEywdjRu`, environment Preview (`target: null`), exact application SHA above. Vercel's Linux static build completed, and the dashboard resource inventory contains 14 static assets with no Functions section. The file-tree API was unavailable, so the actual dashboard inventory and screenshot were used. This does not claim Linux backend/database/server-PDF integration testing.

Source/history scans found no actual secrets or prohibited paths: Gitleaks scanned 31 reachable commits; the additional scan reviewed 822 blob objects, extracted 68 PDF / 84 XLSX objects and compared current private local passwords without disclosure. Six historical heuristic matches were reviewed as invalid-domain rejection tests or randomized test-password prefixes. None was a usable credential. New sample exports contain synthetic records only.

Remote `main`, `prep/vercel-staging`, `fix/vercel-function-entrypoint` and `demo/client-review` retain the exact baseline SHAs in [publication evidence](../development/evidence/attendance-review/publication.json). The original Vercel `development` project's deployment, Node 24 setting, protection and all aliases were rechecked unchanged after publishing. Git deployment automation remains disabled; no main merge, promotion, new project, service, secret or database operation occurred.

Final anonymous HTTPS verification passed **29/29 browser checkpoints** at all five required widths, including both roles, all five destinations, duty/breaks, shops/visits/follow-ups, filters, attendance details, refresh, reset and independent browser storage. Six downloaded Excel workbooks reopened and six genuine Chromium PDFs were generated; all nine PDF pages were rendered and inspected, with embedded fonts and readable Arabic/Malayalam examples. There were zero API/external requests, failed assets, console or uncaught errors. Anonymous HTTP status was 200 and the static security headers were verified. No authentication cookies or bypass tokens were used.

| Final review material | Link |
| --- | --- |
| Executive mobile | [390px screenshot](../development/evidence/attendance-review/https/executive-390.png) |
| Manager desktop | [1440px attendance screenshot](../development/evidence/attendance-review/https/manager-attendance-1440.png) |
| Manager mobile | [390px attendance cards](../development/evidence/attendance-review/https/manager-attendance-390.png) |
| Attendance Excel | [Recorded fictional day, four worksheets](../development/evidence/attendance-review/https/recorded-fixture-attendance.xlsx) |
| Attendance PDF | [Recorded fictional day, two printed pages](../development/evidence/attendance-review/https/recorded-fixture-attendance.pdf) |
| Overnight example | [Excel](../development/evidence/attendance-review/https/overnight-range-attendance.xlsx) / [PDF](../development/evidence/attendance-review/https/overnight-range-attendance.pdf) |
| Automated and browser results | [90 regular tests](../development/evidence/attendance-review/automated-verification.json) / [29 HTTPS checks](../development/evidence/attendance-review/https/verification.json) |
| PDF and headers | [Font/render inspection](../development/evidence/attendance-review/https/pdf-inspection.json) / [Anonymous HTTP headers](../development/evidence/attendance-review/https/header-verification.json) |
| Deployment evidence | [Static build/resource inventory](../development/evidence/attendance-review/build-verification.json) / [Publication and branch preservation](../development/evidence/attendance-review/publication.json) |

The subsequent evidence-only commit records these final hosted screenshots, report samples and results; it does not change the deployed application source. Its exact SHA is the branch HEAD (`git log -1`) and is included in the owner delivery message. The new preview origin starts with its own local data; records from the previous preview do not transfer or synchronize.

**Stop here for owner visual approval.** No confirmed functional blocker remains in the executed static-demo journeys. Actual Android/iPhone usability, human first-time-user feedback, physical printing, the business decisions above and client acceptance remain pending. Do not describe this review as client approved or enable real operations from it.
