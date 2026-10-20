# Emerald Interlink Trading L.L.C — Field Sales CRM

## Requirements source and business summary

The client brief supplied for this demo defines Emerald Interlink as a Dubai-based wholesale building-materials trader with approximately 600–700 shop customers, three field sales executives, and one manager. Executives travel between shops around Dubai and the UAE. The manager needs a reliable record of who visited each shop, when the salesperson arrived and left, what was discussed, what happened with order interest, and when the next visit is due.

No voice recordings were used. The user expressly said they were not needed after the first prompt referenced them. This specification follows the replacement client brief. The business type, team, workflows and scope are therefore taken directly from that brief, rather than inferred from audio. All names, shops, contacts, visit histories, phone numbers and locations in the demo are invented.

**One-sentence product definition:** A field-sales CRM for Emerald Interlink's sales executives to check in and out at shops, record each visit, add new shops and leads, and let the manager see complete shop and salesperson visit history.

## Business, team and existing systems

- Business: Dubai wholesale building-materials trading company.
- Service/division: no separate business divisions were specified; shops sell/use building supplies.
- Current field team: Ahmed, Shihab and Naseer as fictional executive names; Manager / Admin is the fictional manager role. The interface accommodates additional executives through a central, extensible team list.
- Existing commercial system: Zoho Books handles bills, invoices, sales orders and accounting. The CRM records only descriptive order interest/status from a visit. It does not duplicate those commercial records.
- Customer estate: roughly 600–700+ shops, across areas such as Al Quoz, Deira, Ras Al Khor, Al Qusais, Dubai Investment Park, Al Barsha and Jebel Ali.

## Pain points the CRM addresses

- The manager cannot easily confirm which shops executives actually visited during the day.
- Arrival and departure times, visit durations, discussion notes and outcomes need one attributable history.
- A shop's previous visits and total visit count must be visible to any executive who opens the record.
- Follow-up dates need to remain connected to the shop and surface when due or overdue.
- New shops discovered on the road need a quick mobile-friendly capture and an immediate visit option.
- The manager needs a daily activity view and a salesperson history without adding a large office-sales CRM.

## Required modules

1. **Dashboard:** today's check-ins, completed visits, new shops and pending follow-up count; current visits; activity table; per-executive daily progress; due follow-ups; newly discovered shops.
2. **Shops:** searchable 36-shop fictional directory, intended to scale to the full customer estate; search by shop name, mobile, contact or area; executive, area, status, last-visited and follow-up filters; individual shop profile.
3. **Visits:** chronological, searchable visit history with today, yesterday, week and month ranges plus executive, area and visit-status filters.
4. **Leads:** newly discovered shops, with simple New Lead, Contacted, Interested and Not Interested states.
5. **Sales Team:** executive totals for visits today/this week, captured shops, follow-ups and the latest visit; click through to that salesperson's complete visit history.

Follow-up is part of a shop visit, not an independent task-management module.

## Operational workflow

**Existing shop:** salesperson selects their working identity, searches the directory, opens the shop profile and reviews previous visits, checks in, records discussion/status/order interest/follow-up during checkout, and checks out. The visit is saved against both shop and salesperson. The shop's current status, last visit and next follow-up are updated, and the manager's dashboard and visit history immediately reflect the completed visit.

**New shop found on the road:** executive adds the shop's name, contact, mobile, area, location and notes. The shop is saved as a new lead under the executive. From the form, the executive may begin the first check-in immediately; that initial visit can be completed with the same status, notes and follow-up flow.

**Manager review:** dashboard shows current-day field activity and open visits. Executive cards link to a filtered, complete visit history. Each shop profile shows its total visit count, date, salesperson, arrival, departure, duration, outcome, discussion and follow-up.

## Visit details and order interest

- Visit statuses: Regular Visit; Follow-up Required; Order Expected; Order Received; Not Interested; Customer Not Available; Closed; New Opportunity.
- Simple order indicator: No Order; Order Expected; Order Received, with optional explanatory note and approximate value in AED. This is not an order entry or accounting record.
- Next follow-up date is optional and stored on the shop and the visit that created it.
- Check-in stores salesperson, shop, date/time and a location label. Checkout records date/time and duration.
- Where browser geolocation is available in a secure browser context, the demo optionally captures a one-time location fix at check-in. A permission denial leaves the visit workflow available. There is no route tracking or background location collection.

## Assumptions and functionality intentionally simulated

- The original request's recordings were omitted when the user said they were not needed. This spec relies on the subsequently supplied detailed Emerald Interlink brief.
- The 36 example shops stand in for a 600–700+ customer directory; the search and filters are client-side and need pagination/server search for production scale.
- Selecting a salesperson in the top bar simulates a demo role switch; it is not authentication or access control. A selected Manager identity checking in creates an attributed executive visit under Ahmed to keep the sample roster within the three-executive client team.
- Shop address/location labels are demo addresses. GPS capture is optional and only occurs after a button-triggered check-in when geolocation is supported and permission is granted.
- Local browser storage provides persistence in the current browser. “Reset demo” restores the fabricated starting records. Data does not sync between salespeople, devices or a production manager account.
- A seeded active visit and dated prior visits make the manager dashboard and history demonstrable immediately. All dates for historical data are relative to the viewer's current date, except the narrative example in the source requirements; check-in and check-out record actual browser time.
- Sales counts, planned twelve-shop daily targets and demo statuses are illustrative. No monetary KPIs, quotation module, invoices, accounting, products, inventory, full sales orders, deliveries, project tracking, contracts, HR or payroll are included.

## Production CRM capabilities to assess later

- Role-based authentication for manager, sales executive and administrator; an expandable roster; audit trail and ownership rules.
- Centrally synchronized, paginated 600–700+ shop directory and deduplicated mobile/area search.
- Manager reporting backed by server-side aggregation and near real-time event updates.
- Location-consent, geofence policy and secure check-in/check-out event handling where the client requests those capabilities.
- Configurable UAE time-zone and offline/mobile connectivity behavior, with conflict-safe visit synchronization.
- Import and customer-field mapping from the client's existing tools; integration with Zoho Books only if the client later wants a clearly scoped link rather than duplicate accounting records.
- Configurable user-visible deletion/export policy, backups and privacy controls appropriate to the client's real deployment.
