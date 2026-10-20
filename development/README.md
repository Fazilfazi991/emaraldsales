# Emerald Field Sales CRM — local foundation

Emerald Interlink Trading L.L.C's building-materials field CRM. This development application preserves the supplied demo's five modules and styling, with a separate TypeScript server and disk-backed PostgreSQL persistence. The unchanged snapshot is in `../reference/emerald-field-sales-crm-source/`. This is a local engineering review build; client acceptance and production release are pending.

## Open the prepared application

The local URL is **http://127.0.0.1:3100/**. Five real local accounts use random passwords held only in `.local/accounts.json` (gitignored). The executive usernames are `ahmed@local.invalid`, `shihab@local.invalid`, and `naseer@local.invalid`; manager/admin accounts are also listed in that file. Read passwords locally; do not send them in chat. These are synthetic review accounts, not supplied staff accounts. Shihab has a seeded open visit; Ahmed is the clean starting user.

Shared history/search, manager views, sign-in and duty timing are enabled. **Visit/follow-up writes are gated pending the user's open-visit/follow-up decision.** The complete write slice has been tested under explicit `approved-v1` policies in isolated temporary databases. See [decisions](docs/DECISIONS.md). No hosted services, customer imports or deployments exist.

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

Tests create and remove their own temporary synthetic PostgreSQL databases. They do not read or reset `.data/crm`. Browser tests deliberately enable the proposed visit policy only in that harness. `pnpm test:reference` requires the unchanged snapshot's static server on 8080 and refreshes synthetic fixtures/screenshots; it never changes reference files.

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

There is no invoicing, inventory, payments, dispatch, payroll, Zoho connection, offline sync, continuous GPS, hosting provisioning, real customer import or production rollout.
