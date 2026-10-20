# Emerald Field Sales CRM — Phase 2 local application

Emerald Interlink Trading L.L.C's building-materials field CRM. The TypeScript application preserves Emerald's five modules and recognizable style, with real sessions and disk-backed PostgreSQL persistence. Phase 2 adds the approved visit rules, explicit shop transfers, independent follow-ups, a simpler executive day, and manager activity/duty/follow-up reports with Excel/PDF downloads. The unchanged demo remains in `../reference/emerald-field-sales-crm-source/`. Client acceptance and production release remain separate from local engineering checks.

## Open the prepared application

The local URL is **http://127.0.0.1:3100/**. Five real local accounts use random passwords held only in `.local/accounts.json` (gitignored). The executive usernames are `ahmed@local.invalid`, `shihab@local.invalid`, and `naseer@local.invalid`; manager/admin accounts are also listed in that file. Read passwords locally; do not send them in chat. These are synthetic review accounts, not supplied staff accounts. Shihab has a seeded open visit; Ahmed is the clean starting user.

**Visit/follow-up writes are active under `approved-v2`: one active visit per executive; several executives may visit the same shop.** Visits record their authenticated performer and never transfer shop ownership. Managers/admins can edit/transfer shops and assign pending follow-ups with a reason and audit record. Executives manage their own follow-ups. Managers start on a simple daily overview with staff/date filters and Excel/PDF downloads. See the [Phase 2 handoff](docs/PHASE2-HANDOFF.md) for exact verification and remaining launch blockers. No hosted resources, real customer imports or production deployment exist.

## Reproduce on Windows

Node 22+ and pnpm 11.25.0 are required. The PowerShell wrapper uses an installed pnpm or this Codex environment's bundled pnpm, without changing global settings. From this directory:

```powershell
.\scripts\run.ps1 install --frozen-lockfile
Copy-Item -LiteralPath .env.example -Destination .env
.\scripts\run.ps1 build
.\scripts\run.ps1 db:migrate
.\scripts\run.ps1 db:seed --synthetic 700
.\scripts\run.ps1 dev
```

On a machine with pnpm, the equivalent commands are `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm db:migrate`, `pnpm db:seed --synthetic 700`, and `pnpm dev`. Do not rerun seed on the prepared database: it deliberately refuses nonempty databases. Do not overwrite an existing `.env` when updating.

The original `python` command was a Windows Store alias here; baseline validation used the bundled Python executable. The supplied reference server is separate, at port 8080. Browser checks use installed Microsoft Edge through Playwright. No Docker engine or system PostgreSQL installation is needed: PGlite executes PostgreSQL locally, with files under `.data/crm`. Only one process may open a given data directory. Stop the server before migrations, account CLI commands or backups. A stale process lock is recovered only when its recorded process no longer exists.

`HOST`, `PORT`, `APP_ORIGIN`, `DATA_DIR`, `COOKIE_SECURE`, `VISIT_POLICY`, `DUTY_POLICY` and `NODE_ENV` are documented in `.env.example`. The origin and URL must agree exactly. Loopback binding is enforced and `NODE_ENV=production` fails deliberately. Use HTTPS and secure cookies when later configuring an authorized hosted environment.

## Checks

```powershell
.\scripts\run.ps1 build
.\scripts\run.ps1 test
.\scripts\run.ps1 test:browser
.\scripts\run.ps1 test:integrity
```

Tests create and remove their own temporary synthetic PostgreSQL databases; they do not reset `.data/crm`. Phase 2 browser checks use separate authenticated executive/manager accounts at 390/430/768/1024/1440px, actual APIs/database and native report downloads. Run `pnpm test:runtime` against the prepared port-3100 app for a read-only operational smoke check apart from sign-in/sign-out. The historical `scripts/browser.ts` records Phase 1 assumptions and is not the Phase 2 acceptance command. `pnpm test:reference` requires the unchanged snapshot's static server on 8080; it captures reference evidence only.

To bootstrap an account in an otherwise empty local database, first migrate, create a private local password file with a random password of at least 14 characters, then run:

```powershell
.\scripts\run.ps1 account:create person@example.invalid "Person Name" executive .local\private-password.txt
```

The CLI is a trusted host-operator bootstrap tool, not a web permission bypass. The protected `/api/accounts` API allows admins only. Password recovery, offboarding and administrative UI remain future work. Never use synthetic fixtures on a customer database.

## Review records

- [Scope, source evidence and module map](docs/SCOPE-AND-EVIDENCE.md)
- [Architecture, schema, permissions and API contracts](docs/ARCHITECTURE.md)
- [Approved and outstanding decisions](docs/DECISIONS.md)
- [Migration, import and rollback plan](docs/MIGRATION-AND-RELEASE.md)
- [Handoff and executed verification](docs/HANDOFF.md)
- [Executive, manager and mobile UAT checklist](docs/UAT.md)
- [Phase 2 current handoff and launch blockers](docs/PHASE2-HANDOFF.md)
- [Phase 2 ownership and acceptance plan](docs/PHASE2-PLAN.md)

Report downloads are manager/admin-only, filtered and audited. Excel preserves Unicode text; the current PDF font supports Latin text and explicitly asks for Excel when a script cannot be rendered. There is no invoicing, inventory, payments, dispatch, payroll, Zoho connection, offline sync, continuous GPS, hosting provisioning, real customer import or production rollout.
