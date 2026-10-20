# User-side acceptance review

Status: Phase 2 developer verification covers the approved-v2 candidate; **client review has not occurred**. Visit/follow-up writes are now active locally: one active visit per executive, multiple executives per shop. Use synthetic accounts/data only. Record reviewer, device/browser, date, observed behavior and pass/correction request for each scenario. The starting executive is Ahmed; Shihab has a fictional active visit. Open a separate authenticated manager session. Engineering checked 390/430/768/1024/1440px; follow with actual field phones/keyboards and first-time staff users.

| Scenario | Review steps / acceptance question | Client result |
| --- | --- | --- |
| Sign in and populated user side | Sign in as executive; confirm name/role, five modules, useful shop/history information and understandable errors. No identity selector or Reset demo should exist | Pending |
| Shared history | Search Al Noor by name/contact/phone/area; inspect history written by multiple executives even when shop is assigned elsewhere | Pending |
| Existing shop | Review history, deny GPS permission, check in, record notes/outcome/optional interest/new follow-up, check out, reload; verify one completed visit. A different executive can check in to the same shop | Pending client review |
| Manager review | In a second session refresh activity and inspect shop history; confirm visitor attribution, preserved assignment and no manager check-in/checkout controls | Pending |
| New discovery | On mobile capture a fictional shop with a short form; save, then use the visible check-in action. Confirm creator and visitor are the actual signed-in executive | Pending client review |
| Follow-up ownership/history | Verify existing items survive later visits; owner adds a separate follow-up, reschedules and completes; another executive can read but cannot act. Manager explicitly assigns pending follow-ups with a reason | Pending client review |
| Manager reporting | Log in to Daily activity, identify staff duty status, completed visits and pending follow-ups; choose one executive/date and download Excel/PDF directly. Confirm visible filters govern the file | Pending client review |
| Explicit shop transfer | Manager opens Manage shop, chooses an active executive and supplies a reason; confirms transfer. Verify prior visits and existing follow-up owners are preserved and record history identifies the manager | Pending client review |
| Duty controls | Start duty → rest → return → rest → return → end. Confirm distinct events, own history and manager team visibility; another executive cannot access it; visits remain independent | Pending |
| Duty business rules | Confirm end-from-rest is blocked, repeated sequential sessions are permitted and an open session can span UAE midnight. Specify allowed shifts/rest periods and missed-event/cut-duty correction requirements | Pending |
| Failed/uncertain save | Interrupt connectivity during a save; verify an explicit unconfirmed message, preserved form and same-request retry, then check shared history. No offline sync is promised | Pending |
| Mobile usability | Review shop search/profile, checkout, lead form, duty controls, keyboard visibility, reachable save buttons, bottom navigation and no page overflow on actual devices | Pending |
| Scope | Confirm approximate order interest is descriptive; accounting stays in Zoho Books. Confirm no inventory, invoicing, payments, dispatch or payroll is expected in this slice | Pending |

Current developer browser evidence is `evidence/phase2/browser.json`; Phase 1 evidence remains separately in `evidence/browser.json`. Phase 2 uses genuine accounts/APIs/database, five widths, failed-write and lost-acknowledgement retry, follow-up lifecycle and manager reports/downloads. This does not substitute for first-time human executive/manager acceptance. Real GPS success/accuracy and operational recovery still need field/device validation.
