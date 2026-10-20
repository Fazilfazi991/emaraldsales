# User-side acceptance review

Status: developer verification passed for the implemented candidate; **client review has not occurred**. Use synthetic accounts/data only. Record reviewer, device/browser, date, observed behavior and pass/correction request for each scenario. The starting executive is Ahmed; Shihab has a fictional active visit. Open a separate authenticated manager session for visibility checks. Use 390px mobile and 1440px desktop as initial sizes, followed by actual field phones and keyboards.

| Scenario | Review steps / acceptance question | Client result |
| --- | --- | --- |
| Sign in and populated user side | Sign in as executive; confirm name/role, five modules, useful shop/history information and understandable errors. No identity selector or Reset demo should exist | Pending |
| Shared history | Search Al Noor by name/contact/phone/area; inspect history written by multiple executives even when shop is assigned elsewhere | Pending |
| Existing shop | After D03 approval/enabling: review history, deny GPS permission, check in, record notes/outcome/optional interest/new follow-up, check out, reload; verify one completed visit | Pending / policy-gated |
| Manager review | In a second session refresh activity and inspect shop history; confirm visitor attribution, preserved assignment and no manager check-in/checkout controls | Pending |
| New discovery | On mobile capture a fictional shop; save a lead. After D03 approval, test Save & Check In and completion. Confirm creator and visitor are the actual signed-in executive | Pending / immediate visit policy-gated |
| Follow-up ownership/history | After D03 approval: verify existing items survive later visits; owner reschedules with reason and then completes; another executive can read but cannot act on it | Pending / policy-gated |
| Duty controls | Start duty → rest → return → rest → return → end. Confirm distinct events, own history and manager team visibility; another executive cannot access it; visits remain independent | Pending |
| Duty business rules | Confirm end-from-rest is blocked, repeated sequential sessions are permitted and an open session can span UAE midnight. Specify allowed shifts/rest periods and missed-event/cut-duty correction requirements | Pending |
| Failed/uncertain save | Interrupt connectivity during a save; verify an explicit unconfirmed message, preserved form and same-request retry, then check shared history. No offline sync is promised | Pending |
| Mobile usability | Review shop search/profile, checkout, lead form, duty controls, keyboard visibility, reachable save buttons, bottom navigation and no page overflow on actual devices | Pending |
| Scope | Confirm approximate order interest is descriptive; accounting stays in Zoho Books. Confirm no inventory, invoicing, payments, dispatch or payroll is expected in this slice | Pending |

Developer browser evidence in `evidence/browser.json` covers the main journey, independent manager session, HTML safety, mobile modules/forms/duty and a deliberately lost checkout acknowledgement. It does not substitute for the actual executive/manager review. Real GPS success/accuracy and operational recovery still need field/device validation.
