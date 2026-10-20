# Phase 2 execution plan — 20 October 2026

Accepted starting commit: `ec26756`. Local-only integration branch: `phase2/integration`. Source reference remains immutable. No deployment, real customer import, production accounts, Zoho connection or merge to main is authorized.

## Task breakdown and ownership

| Role / isolated branch | Exclusive implementation files | Deliverable |
| --- | --- | --- |
| Backend / phase2/backend | `src/service.ts`, `src/domain.ts`, `src/config.ts`, `src/server.ts`, new migrations, `tests/foundation.test.ts`, `tests/backend-phase2.test.ts`, `.env.example` | One active visit per performer; same-shop concurrent performers; explicit audited manager/admin shop transfer and follow-up assignment; versioned safe shop changes; standalone follow-up creation; protected audit history; regression tests |
| Mobile UX / phase2/mobile | `client/app.ts`, `client/style.css`, `client/index.html` | Preserve existing design; own visit controls amid other visitors, discovery/shop forms, owned follow-up operations and manager assignment controls, duty state, loading/failed/unconfirmed/retry feedback, responsive forms |
| Manager / phase2/manager | New `src/reports.ts`, `client/manager.ts`, `tests/reports.test.ts`; no shared server/client entrypoint edits | Protected manager report service + self-contained UI: date/person-filtered activity, duty intervals/attendance visibility, independent follow-up monitoring |
| QA / phase2/qa | New `tests/phase2-acceptance.test.ts`, `scripts/phase2-browser.ts`, `scripts/phase2-runtime.mjs`, `evidence/phase2/*` | Independent authorization, race, retry, rollback/fault tests and genuine separate-account journeys at 390/430/768/1024/1440px |
| Coordinator / phase2/integration | Plans/decisions/docs, package scripts, data adapter/operations as needed; final report/server/client wiring after owners finish | Checkpoint verification; API contract coordination; ordered cherry-picks; code review; local backup/migration/activation; acceptance and handoff |

Four total execution slots allow the coordinator and three specialists simultaneously. QA starts when one specialist completes; its independent checks run against the integrated candidate. Each agent works in a separate Git worktree and commits only its owned paths. Coordinator integrates commits explicitly and assigns fixes to the original owner while that agent remains active. No agent overwrites another's files or changes the running local database/environment.

Mandatory usability steering from the owner applies to every role: preserve Emerald, make executive actions mobile-first and clearly labelled, keep visit forms short with optional detail collapsed, and default managers to simple daily attendance/visit/follow-up tables with obvious staff/date filters and Excel/PDF downloads. No charts or advanced administrative screens are added to daily work. QA must complete the novice-labelled executive and manager journeys without technical instructions. Downloadable reports are manager/admin-only; full customer exports remain outside scope. The coordinator owns runtime Excel/PDF serializers and their verification.

## Agreed contract before implementation

- `VISIT_POLICY=approved-v2` identifies the newly approved policy: one open visit per executive, **no unique-open-shop restriction**. Retain pending as the safe gate; approved-v1 is historical and must not activate the old rule silently.
- Existing visit/checkout DTOs remain stable. Own open visit controls take precedence over another executive's open visit in the same shop.
- Manager/admin explicit shop transfer and follow-up assignment approved by the user in this Phase 2 chat. Require active same-organization executive, expected version, reason, transaction, idempotency and audit. Shop transfer does not move existing follow-ups or alter past visits. Executives can update only owned follow-ups; shared reading continues.
- New candidate routes: POST `/api/shops/:id/update`, POST `/api/shops/:id/transfer`, POST `/api/followups` (originating visit + due date, owner defaults to performer), POST `/api/followups/:id/assign`; GET `/api/shops/:id/audit` for attributable shop/visit/follow-up history. Document exact validated payloads in the backend handoff before UI integration.
- Report module exports `Reports` accepting `Database`, methods `activity(actor, params)`, `duty(actor, params)`, `followups(actor, params)`; coordinator wires GET `/api/reports/activity|duty|followups`. Manager/admin only, organization-scoped, UAE dates, bounded/paginated lists with totals, input validation. Reporting never invents absence, late/paid/unpaid or payroll rules.
- Manager client module exports a small typed integration contract and renders using current panel/table/form classes. Coordinator wires it into Sales Team/report controls after backend/client merges. No replacement navigation/design system.
- Unclear correction, shift limits, lead conversion, account recovery/production identity and export/import policies stay documented and unavailable.

## Acceptance criteria by checkpoint

1. Re-run strict build, foundation tests and source integrity at the accepted commit; inspect auth/session, schema/migrations, 700-shop persistence and approved-rule differences. Record actual fresh results.
2. Apply new migrations only; prove two executives can check in to one shop while one executive cannot open two visits; prove retries/races, ownership, assignment preservation and rollback after injected DB failure. Only then migrate and activate the local synthetic runtime.
3. Complete authenticated executive search/history/check-in/checkout/follow-up and duty journeys; manager sees independent authoritative activity/duty/follow-up reports; transfers and assignments are explicit/audited; all sensitive APIs enforce authorization.
4. Independent API and genuine browser checks use separate accounts and isolated test databases; verify 390/430/768/1024/1440px, refresh, logout/login, same-shop second performer, repeated checkout, uncertain-save retry, manager filters, safe rendering and failed database writes without partial changes. Capture screenshots and report exact passed/failed counts.
5. Deliver branch/commit list, per-agent features, migration inventory and rollback plan, setup/run commands, screenshots, unresolved questions and launch blockers. Distinguish local engineering acceptance from client acceptance and production readiness.
