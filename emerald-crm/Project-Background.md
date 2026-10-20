# Emerald Field Sales CRM — ChatGPT Project background

Prepared 2026-10-20 for a **ChatGPT Project acting as a supervisor** of later developer work. This is not a Codex project setup or an instruction to implement/deploy now. Upload this file, the source ZIP and README to the Project; place the separate supervisor prompt in Project instructions. Source facts and known issues are detailed in `DEMO-INVENTORY.md` inside the ZIP.

## Current objective and approval context

The user reports that the client approved the Emerald Field Sales CRM demo and asked for its source so a production CRM can be developed from it. Treat the demo as the approved UI/workflow starting point. The approval is user-reported, not independently verified formal scope acceptance, contractual authorization, security approval or evidence of production readiness. There are no approved production prices, budgets, dates or commercial amounts in this handoff.

The supervisor should help the user define decisions, stage developer assignments, review proposed changes and evidence, preserve the recognizable approved UI, and track scope through production readiness. It should not invent missing client requirements, silently expand into a general ERP, or claim to have executed developer work it has only reviewed.

## Correct product and source identity

Product: **Emerald Field Sales CRM**, for **Emerald Interlink Trading L.L.C**, a Dubai building-materials wholesale trader. Correct route: `/demo/emerald-interlink`. The portfolio title, HTML title/branding and original requirements agree. Do not confuse it with AquaFleet, which is a separate water transport/dispatch/accounting demo under `public/water-transport-crm` in the same repository.

Original local repository: `C:\Users\USER\Desktop\Projects\Fusion Ventures Website`; GitHub repository `Fazilfazi991/fusionwebsite`; branch `main`; export HEAD `4fd5bf3b1d0822a7190b4b8f153349134985c06c`. The exported files match HEAD. The original working tree contains unrelated untracked company-profile files and a Hamdee test; these were excluded. The export preserves originals and changes no source behavior.

The reusable runtime is `public/demo/emerald-interlink/index.html` plus `favicon.svg`. All styling, application logic and fictional data live inline in that HTML. The larger portfolio's Next.js/React packages and backend integrations are not used by this standalone demo. Do not infer Supabase or another service has been selected for production simply because it appears elsewhere in the repository.

## Business setting and boundaries

The original brief describes roughly 600–700 shop customers, three travelling executives and a manager, operating in Dubai and across the UAE. Example coverage includes Al Quoz, Deira, Ras Al Khor, Al Qusais, Dubai Investment Park, Al Barsha and Jebel Ali. All sample executive names, shops, contacts, mobile numbers, addresses and visit histories in the source are fictional.

The business need is attributable shop coverage: who visited each shop, arrival/departure, what was discussed, order interest, next follow-up and a shared history for the next executive. The manager needs daily activity and per-executive visibility. Zoho Books is described as the existing system for bills, invoices, sales orders and accounting. Its current configuration and any production integration remain unknown. A visit's optional AED order-interest estimate is not an invoice or a commercial commitment.

Baseline excludes a product catalogue, stock/inventory, formal quotations/orders, delivery/dispatch, payments/accounting, contracts, HR/payroll and a standalone tasks module. New scope requires a recorded decision and impact review.

## Functional baseline

| Module | Baseline to preserve |
| --- | --- |
| Dashboard | Daily KPIs, activity table, three executive progress cards, open visits, upcoming/overdue follow-ups and recent shops. |
| Shops | Search and executive/area/status/visit filters; shop profile with contact/location, assignment, follow-up and complete visit history. |
| Visits | Searchable chronology with date-range, salesperson, area and status filters; arrival, departure, duration, outcome and follow-up. |
| Leads | New-shop discovery, basic contact/area/location/notes capture, save or save-and-check-in, simple interest statuses. |
| Sales Team | Executive summaries and links to their full history. Actual roster administration is not implemented. |

Existing-shop journey: select identity in the intended demo control → find shop → review history → check in → record discussion/outcome/order interest/follow-up during checkout → save → review updated shop/dashboard/history. New-shop journey: add discovery details and assigned executive → save lead, optionally start visit → complete checkout. Manager journey: review current day/open visits/due follow-ups → inspect executive history → inspect shop history.

Shop data observed in source: `id`, `name`, `contact`, `phone`, `area`, `location`, `salespersonId`, `status`, `createdBy`, `createdAt`, `notes`, `lead`, `isSeed`, `nextFollowUp`, `lastVisit`, `visitIds`. Visit data: `id`, `shopId`, `salespersonId`, `checkedInAt`, `checkedOutAt`, `status`, `notes`, `orderStatus`, `orderNote`, `orderValue`, `followUpDate`, `location`, optional `gps`, `durationMinutes`. Team entries: `id`, `name`, `role`, `initials`. These are observed JavaScript shapes, not an approved normalized database design. Derivable counts/dates and duplicated relationships need deliberate schema treatment.

Visit outcomes are Regular Visit, Follow-up Required, Order Expected, Order Received, Not Interested, Customer Not Available, Closed and New Opportunity. Order interest is No Order, Order Expected or Order Received. Lead status logic and filter choices are inconsistent in places; decide a canonical transition model before implementing it.

## Demo dependencies, simulation and caveats

The app uses modern browser DOM, dialog/FormData, Intl, localStorage and optional geolocation. There are no imported framework/CDN/API/map dependencies in the HTML; its only linked runtime asset is a local SVG. Python's built-in server is an optional preview tool. Node/Playwright/Edge are only relevant to the original reference acceptance script, which contains environment-specific paths, a fixed historical date and original-website checks.

There are 36 seeded shops, three fixed executives and a Manager/Admin option. Browser storage is one JSON state under `fusion-emerald-interlink-field-crm-v1`, per origin/browser. Data can be altered in browser tools, lost/reset or remain isolated on another device. It is not central persistence, a backup or synchronized offline capability. There are no real accounts, access rules, server validation, central audit, migrations or operational monitoring.

The identity selector is simulated and its source change listener appears attached to a sibling container, so role changes require a deliberate correction. Manager check-ins map to Ahmed. Shop assignment can diverge from visit attribution during save-and-check-in; checkout may transfer the assigned executive. An active-visit text count can be inaccurate. Server-enforced concurrency, allowed transitions and immutable attribution do not exist. Preserve intended journeys, not these defects.

Optional GPS is requested once at check-in in a secure context, can use a cached fix, and falls back without preventing the visit when denied. No continuous tracking, geofence or anti-spoofing exists. Date grouping mixes device-local dates with UTC ISO slices; UAE reporting day rules need a decision. Seed data uses illustrative relative history/current-day activity. Browser device time is trusted.

Read `VALIDATION.md` for the export's actual checks. A source snapshot, syntax check or passing preview test is not evidence of production security, usability, scale or acceptance. Known issues are not fixed in this handoff.

## Production target to define with the client

A shared, authenticated field CRM should preserve the approved interface and core visit journeys while adding reliable multi-user records, protected roles, attributable server events and clear operations. This is a proposed direction inferred from the brief and must be confirmed as scope. Specific technology, provider, deployment region, domain, capacity targets and rollout dates are undecided.

Before development commits to behavior, resolve:

| ID | Decision needed | Current state |
| --- | --- | --- |
| D01 | Formal MVP scope, acceptance owner, which demo UI/features are approved and any requested changes | Unknown; only demo approval reported. |
| D02 | Stack/backend/database, code ownership/repository and maintainers | Unknown; do not assume portfolio services are selected. |
| D03 | Manager/admin/executive permissions, shop sharing/assignment/transfer rules, account provisioning and recovery | Unknown. |
| D04 | Real customer source, import permission, field mapping, duplicates, number formats, data cleanup and migration reconciliation | Unknown; no real data included. |
| D05 | Check-in/out rules: multiple visits, actor attribution, edits, cancellation, missing checkout, concurrency and supervisor correction | Unknown. |
| D06 | GPS purpose/consent/retention, allowed denial/accuracy behavior, geofence need, supported devices and offline/sync policy | Unknown. |
| D07 | UAE timezone, KPI definitions, targets, lead transitions and follow-up ownership/completion/reminder rules | Unknown; demo figures/statuses are illustrative. |
| D08 | Zoho Books boundary and whether an integration or simple reference is required | Existing system described; integration unapproved. |
| D09 | Hosting/region/domain, dev/staging/prod separation, privacy/retention/export/deletion, backups, monitoring and operational owner | Unknown. |
| D10 | UAT participants, representative data, accessibility/mobile acceptance, rollout/rollback and support process | Unknown. |

Only prioritize questions needed for the next stage; keep remaining decisions visible. Never invent prices, commercial amounts, compliance certification or production-ready claims.

## Suggested staged developer plan

1. **Baseline and discovery:** run the faithful demo; review the supplied files and validation caveats; capture approved desktop/mobile views and key journeys; confirm D01 and critical permissions/visit rules. Output scope baseline, decision log, risk list and measurable acceptance scenarios. No deployment or real data by default.
2. **Architecture and data contract:** propose stack and environments; model users/roles/shops/visits/follow-ups and audit events; specify API contracts, authorization, visit transitions, idempotency and concurrency, timezone and import mapping. Review tradeoffs and unresolved decisions before implementation.
3. **Secure vertical slice:** implement authenticated existing-shop search → check-in → checkout → manager visibility with server validation/persistence/audit and least privilege. Preserve UI using explicit adapters/components. Show role-denial, tampering, duplicate-submit/concurrent-check-in and timezone evidence as well as the happy path.
4. **Complete MVP journeys:** new-shop/lead capture, histories, filters, team summaries, follow-ups and authorized customer import. Add agreed mobile/connectivity/GPS behavior, canonical status transitions and pagination/search. Keep Zoho integration separate unless explicitly approved.
5. **Readiness and UAT:** migration rehearsal and reconciliation; realistic multi-user/mobile tests; privacy/security review; tested backups/restore; monitoring/alerting, deployment and rollback plan; client UAT against acceptance scenarios. Report evidence and residual risks. Request specific release authorization only when there is a concrete reviewable release candidate.
6. **Rollout and follow-up after authorization:** controlled deployment/data migration, smoke checks, owner handoff and monitoring. Any later phase is conditional on the user's explicit authorization; this export authorizes none of it.

## Supervisor working method and developer handoff

Maintain Project records: Scope Baseline; Decisions (ID/date/options/owner/decision/rationale/status); Requirements and Acceptance Scenarios; Backlog with stage/priority/dependencies; Risks/Issues; Change Log; Evidence/Release Readiness. In a text-only Project, use clearly titled current records and ask the user to upload changed developer files/evidence when inaccessible. Do not claim permanent edits to files or external systems unless a tool confirms them.

Each developer assignment should state objective, exact scope, baseline files/commit, related decision IDs, acceptance scenarios, permitted changes, non-goals, security/data constraints and required evidence. Require a compact handoff with changed files and commit/diff, behavior before/after, setup/migration instructions, test commands/results, screenshots for UI changes, known limitations and a rollback approach when relevant. Never ask for secrets in chat or Project uploads.

Review delivered diffs against requirements and approved UI, including mobile forms/navigation and error/empty/loading states. Distinguish developer-reported claims from evidence you independently inspected or executed. Do not approve from a summary alone. For every requirement, track implemented/tested/accepted separately; passing tests do not equal client acceptance. Record scope changes with client impact and ask the user for business decisions that cannot be inferred.

Release review should require reproducible evidence for login and session recovery, cross-role denial, user/visit attribution, multi-user synchronization, validation and XSS handling, import deduplication, concurrent submit behavior, UAE midnight/date filters, location denial/timeout, offline/reconnect if in scope, persistent reload/device use, permission-restricted exports, restore and rollback. Scale testing should use representative authorized or synthetic data for at least the stated customer estate. Expand tests as justified by agreed scope, not as a claim that every suggested capability has been approved.

## How to begin the ChatGPT Project

Upload the source ZIP, standalone README, this background file and the inventory if useful. Paste `CHATGPT-PROJECT-SUPERVISOR-PROMPT.md` into Project instructions. First ask the supervisor to summarize the verified baseline, identify the few decisions blocking stage one and draft the first developer brief. There is no implementation, deployment, push, account change or production-data change authorized by this handoff.
