# Revised client scope — simple visit discussion

21 October 2026. The owner's confirmed client feedback supersedes the Product Catalogue & Customer Inquiry Module request. Further feature decisions await the manager discussion.

## Agreed scope

- Zoho remains where the client manages products and orders. No Zoho integration is introduced.
- Stop catalogue, item-wise inquiry and related reporting development. Do not add product selection, quantity, brand/specification entry, inquiry screens, orders or invoices.
- Keep customer/shop search, visits, one discussion field, independent follow-ups, duty/break timing, working hours and existing manager reports.
- Complete a visit with **Visit outcome → Visit notes / customer discussion → optional follow-up date → Check Out & Save**.
- Preserve the original customer, performer, visit, saved notes and follow-up history. A later visit does not overwrite earlier discussions.

Inspection started from clean `demo/attendance-review` at `f053278a482b59f7673221d8935a0de8ace60730`. No product catalogue/inquiry implementation, navigation, data collections or unfinished module files were present. The earlier module request had only been inspected; no such functionality was committed, merged or deployed. No cancelled module needed removal from the public demo.

## Local candidate changes

Isolated branch: `demo/simple-visit-feedback`, based on the accepted attendance review above. The final owner delivery message gives the exact local commit; `git log -1` also identifies it.

| File | Change |
| --- | --- |
| `development/client/app.ts` | Demo checkout removes optional order-detail controls; keeps exactly three fields; labels the single notes field clearly; changes the save label. Existing internal order fields receive neutral No Order/empty/null values to preserve the established validation contract. Normal authenticated checkout is unchanged. |
| `development/demo/demo.css` | Demo checkout only: compact notes area, single scrollable body, fixed visible footer and full-width save button. Other dialogs and attendance styles retain their behavior. |
| `development/scripts/attendance-browser.ts` | Adds three-field/layout checks at five widths and a short viewport; verifies notes round-trip on the exact customer/visit/executive after refresh; retains complete attendance/report regression coverage. |
| `development/scripts/demo-browser.ts` | Recognizes the simplified save label, retaining compatibility with the older label. |

No database schema, local data version, migration, store, fixture, attendance calculation, manager reporting logic, backend authentication, authorization or production guard changed. Existing saved demo data is not reset or upgraded by this change. Historical order-related values, if previously recorded, are retained rather than silently erased.

## Executed verification

- Normal TypeScript/client build and isolated static demo build: passed.
- Full regular suite: **90 passed**, zero failed/cancelled/skipped.
- Local browser regression: **31 checkpoints passed**, zero console/page errors, failed assets or API/external requests.
- A brief discussion saved successfully with both a selected follow-up date and, on the separate new-shop journey, no follow-up date. After refresh, its exact customer ID, visit ID, selected demo executive ID and Unicode discussion remained intact. Exactly one linked independent follow-up existed.
- Manager role could read that saved discussion from the customer's visit history after later visits. Follow-up create/reschedule/complete/cancel and reasoned assignment continued working.
- Duty start, two breaks/returns, end, multiple sessions, historical/current statuses, UAE-midnight clipping and manager working-hour totals remained correct. Six downloaded Excel workbooks reopened; six genuine Chromium print PDFs were generated and report totals reconciled.
- Layouts: 390, 430, 768, 1024 and 1440px. Checkout has one textarea, no item/order controls, no outer modal scrollbar and a visible save footer. A 390×430 short viewport with notes focused also passed; this does not certify a real phone keyboard.
- Refresh, role switching, separate-browser storage, customer search, new-shop first visit and Reset Demo Data passed in disposable synthetic browser contexts.

Evidence: [31 executed checks](../development/evidence/simple-visit-feedback/verification.json), [automated summary](../development/evidence/simple-visit-feedback/automated-verification.json), [mobile checkout](../development/evidence/simple-visit-feedback/checkout-owner-mobile.png), [desktop checkout](../development/evidence/simple-visit-feedback/checkout-owner-desktop.png), [saved discussion](../development/evidence/simple-visit-feedback/executive-shop-history-390.png), [manager view](../development/evidence/simple-visit-feedback/manager-attendance-1440.png). Before comparison: [previous deployed checkout](../development/evidence/attendance-review/https/executive-visit-form-390.png).

Physical Android/iPhone, native mobile keyboards and human client acceptance remain pending. No new public deployment is claimed by these local tests.

## Owner review and release boundary

**Review the revised candidate locally: [http://127.0.0.1:3112/](http://127.0.0.1:3112/).** Choose Ahmed, search/open a fictional shop, Check in, then Complete visit. The local static server uses the existing demo security headers and binds only to this computer's loopback interface.

The current [public attendance demo](https://emerald-sales-client-demo-euswu9jl0-faziils-projects.vercel.app) remains unchanged. This candidate has **not been pushed to GitHub or deployed**. Owner approval is required before any new Vercel deployment; no promotion, main merge or existing alias change has occurred.

The demo still uses fictional browser-local records. No hosted database, external API, real employee/customer data, production account, cloud secret or Zoho connection was introduced. Changes in one browser/origin do not synchronize to another. The secure backend/staging branches remain intact.

Pending the manager discussion: any further workflow/report changes, whether the existing brief-discussion requirement should become optional, and any changes to the existing visit outcome labels. Current validation and outcomes remain unchanged; no new business rules were inferred. Catalogue and item-wise inquiry development stays cancelled unless the owner explicitly revises this scope.
