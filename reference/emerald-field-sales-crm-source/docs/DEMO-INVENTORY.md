# Demo inventory and production gaps

Evidence: original `index.html`, original requirements, the portfolio label and route, and original acceptance script. Source locations below refer to the original 134-line HTML; some lines contain whole functions. The HTML is authoritative for behavior.

## Modules and workflow

| Module | Implemented behavior |
| --- | --- |
| Dashboard | Five KPI cards, today's visits, three executive cards, open visits, follow-ups through three days ahead including overdue, and recently added shops. Aggregation happens in the browser. |
| Shops | 36 fictional shop seeds; case-insensitive name/contact/mobile/area/location search; executive, area, status and visited/never/follow-up-set filters; profile, complete local visit timeline and check-in/out actions. The follow-up filter means a date is set, not necessarily due today. |
| Visits | Searchable chronological visit rows; all/today/yesterday/last-seven-days/current-calendar-month, executive, area and active/completed-style status filtering. Browser-held shop/visit links provide history. |
| Leads | Subset of shops with `lead=true`; new shop capture and optional immediate first check-in. Lead status changes through checkout logic. There is no separate lead-to-customer conversion or standalone task module. |
| Sales Team | Three fixed fictional executives, totals and links into that executive's all-time visit history. No user administration UI. |

Existing shop flow: search → open shop → review history → check in → open checkout → enter visit status, required notes, optional order interest/note/value and follow-up → save checkout → see updated shop/history/dashboard. New shop flow: capture name/contact/mobile/area/assigned executive/location/notes → save as New Lead, optionally check in immediately → use the same checkout.

Visit outcomes: Regular Visit, Follow-up Required, Order Expected, Order Received, Not Interested, Customer Not Available, Closed, New Opportunity. Order indicators: No Order, Order Expected, Order Received. Optional approximate value uses AED; it is a descriptive visit field, not a sales order, invoice, payment or accounting record. No commercial amounts or prices are inferred for the production project.

## Source and dependencies

- One HTML file contains all markup, styles, JavaScript, fictional fixtures, rendering and event handling. One local SVG favicon is required by its absolute URL.
- No imported JS/CSS packages, CDN scripts, external images, network API calls, service worker or backend were found in the demo HTML. Fonts use system fallback names; Inter is named in CSS but is not downloaded by this standalone app.
- Browser APIs: DOM/template rendering, native dialog/FormData, Intl date formatting, localStorage, optional geolocation and responsive CSS. Modern browser support is required. Timers dismiss toasts; state re-renders on interaction, without a server subscription.
- Original full-site package.json includes Next.js 14, React 18, Tailwind and unrelated service packages. They are not runtime dependencies of this standalone export and were not copied. The optional original reference test uses Node.js, Playwright and installed Microsoft Edge; none is needed to run the demo itself.
- Team definitions are in `TEAM` (line 30), areas/seeds in lines 31–64, persistence in lines 65–67, rendering/filtering in lines 68–108, dialogs and mutations in lines 109–122, event wiring in lines 123–130.

## Demo-only behavior

- Fictional customer/contact/phone/location/history data; 36 shops represent the stated intended estate of approximately 600–700 shops. Three executives plus one Manager/Admin entry are hardcoded. A daily target of 12 is illustrative.
- `seed()` makes relative historical records plus one open and one completed current-day visit. Some seed dates/narratives are illustrative, not business evidence.
- Data is one browser-origin localStorage JSON object, key `fusion-emerald-interlink-field-crm-v1`. No shared data, synchronization, migrations, backups, central audit or reliable offline conflict handling. Storage failure shows a toast and leaves session memory only. Saved data is minimally shape-checked and merged with a new seed on load.
- The `Viewing as` selector is intended to simulate identity. It is not login or authorization; every module is available. A Manager check-in is attributed to Ahmed. Shop checkout can reassign the shop to the visiting executive.
- Check-in blocks a second open visit at the same shop in that local state, but does not implement a server constraint or restrict one open visit per executive across shops.
- Time and duration trust the device clock. Optional GPS is a one-time browser fix at check-in (permission/support dependent, rounded to five decimals, with up to a one-minute cached fix). GPS denial silently continues with the demo location label. There is no map, geofence, anti-spoofing, route tracking or background collection.
- Reset restores seed records after confirmation and destroys local demo edits. Navigation/views are client state, not separate backend routes. Rendering also writes state to storage.
- No shop edit/delete UI, actual orders, quotations, inventory, invoicing, delivery, payments, accounting, HR/payroll, messaging, notification delivery or Zoho integration is implemented. The brief says Zoho Books remains the existing commercial system.

## Known source issues to resolve deliberately

These are source observations to validate in development, not silent export fixes:

1. The `#salesperson` selector sits in the topbar (line 22), but its change branch is registered on `#content` (line 126), which is a sibling rather than an ancestor. Its change does not naturally reach that handler. Confirm and correct role simulation/auth behavior before relying on identity-dependent results.
2. `submitShop(..., 'checkin')` uses the chosen assigned executive for shop fields but `checkin()` attributes the visit from `state.salesperson`; choosing a different assignee can produce inconsistent attribution.
3. UTC ISO date slices are compared with locally constructed calendar dates (`isToday`, `lastVisit`, date filters). Confirm UAE day boundaries, DST/timezone behavior for remote users and device-clock tampering.
4. Dashboard executive card text uses `mine.length ? 1 : 0` for an active-visit label, which can report one active visit even if all that executive's visits are completed. Some counts/targets are fixed rather than derived.
5. Leads expose status choices that differ from checkout's generated `Contacted` status, so the filtering/status model needs reconciliation. A lead remains marked `lead=true` after interest/order outcomes.
6. The original acceptance script includes a fixed historical-date assertion and full-portfolio checks, making it unsuitable unchanged for this standalone snapshot. Fresh targeted validation is documented separately.

## Production work still required

| Area | Required decision or implementation |
| --- | --- |
| Identity/access | Real authentication, manager/executive/admin permissions enforced server-side, account recovery, onboarding/offboarding, shop ownership/visibility and immutable actor attribution. |
| Persistence | Chosen database/backend, schema/constraints/migrations, validated atomic visit transitions, concurrency and idempotency, server time, audit history, backups and restore evidence. |
| Customer estate | Authorized import from existing tools, field mapping, mobile normalization, deduplication, assignment rules, pagination/indexing and search verified with representative 700+ shop data. |
| Mobile/connectivity | Supported device/browser matrix; offline requirement and sync/conflict policy; reconnect UX; field GPS permission/accuracy/failure policy. PWA/native app is undecided. |
| Security/privacy | Threat model, server validation, XSS/session/CSRF strategy as appropriate, encryption/secrets handling, retention/export/deletion policy, location consent, least privilege and audit access. Review inline rendering and CSP for the selected production stack. |
| Reporting | Agreed KPI definitions, targets, UAE reporting timezone, follow-up ownership/rescheduling/completion rules, late or missing checkouts, manager freshness requirements and optional notifications. |
| Integrations | Zoho Books integration is undecided and requires explicit scope and credentials handling. Do not duplicate its accounting responsibilities by assumption. |
| Delivery/operations | Hosting/provider/region/domain/environments, CI/CD and rollback, monitoring/error reporting, operational owner, tested recovery, UAT acceptance and support arrangements. No deployment exists in this package. |

Architecture, budget, commercial terms, production credentials, hosting, real customer data, user accounts, formal acceptance criteria and final scope are unknown. No production readiness is asserted.
