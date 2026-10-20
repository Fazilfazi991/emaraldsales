# Emerald Field Sales CRM — Phase 3 local demonstration

Hosted staging preparation is on `prep/vercel-staging`: see [minimum Vercel setup and owner approvals](docs/VERCEL-STAGING-PREPARATION.md). It is not connected or deployed. The local production guard remains intact; the separate hosted entrypoint requires explicit synthetic-staging approval and validated configuration.

The [Vercel runtime investigation](docs/VERCEL-RUNTIME-FIX.md) records the browser-bundle entrypoint fix, local artifact evidence, remaining Linux/hosted checks and the owner-approved replacement sequence.

The application preserves Emerald's existing green interface, five destinations, real authentication and disk-backed PostgreSQL data. Phase 3 adds visible/resettable filters, a clearer mobile manager overview, simpler navigation names, and Unicode PDF reports with selected staff, dates and totals. This is a local owner-review candidate; client acceptance and production release are pending.

## Run the demonstration

From this `development` directory, with Node 22+ and pnpm 11.25.0:

```powershell
pnpm install --frozen-lockfile
pnpm pdf:setup
pnpm build
pnpm demo:prepare
pnpm demo:start
```

Use `demo:prepare` **once**, for the new isolated `.data/phase3-demo` database. It refuses existing data or credentials. For the already-prepared demonstration, run only `pnpm demo:start`. Stop an existing port-3100 server before starting another. Open **http://127.0.0.1:3100/**.

Random synthetic passwords are in **`.local/phase3-demo-accounts.json`**, ignored by Git. Use `ahmed@local.invalid` for the executive journey and `manager@local.invalid` for management. Additional fictional accounts include Shihab, Naseer and a local administrator. Keep passwords private. The demo has 700 fictional shops, including Arabic, Malayalam and accented Latin examples. Shihab has a seeded open visit; Ahmed is the intended starting executive. The original Phase 2 `.data/crm` database and `.local/accounts.json` remain separate and preserved.

`pdf:setup` installs the Playwright-pinned Chromium browser locally. PDF export uses it at runtime, with network requests blocked, JavaScript disabled and bundled SIL-OFL Noto fonts. This is an explicit runtime dependency on every development machine. Missing browser setup produces a useful PDF error and leaves Excel available. Latin, Arabic and Malayalam are verified; additional scripts/emoji may need another licensed font. Browser binaries are not committed. [Font sources and license](assets/fonts/README.md).

On this Windows environment, `.\scripts\run.ps1 <command>` finds installed pnpm or the Codex bundled pnpm. The default `python` command here is a Windows Store alias; PDF inspection uses the bundled Python runtime and Poppler.

## Local data and permissions

The demo starter uses `.data/phase3-demo` and approved local visit/duty policies. `pnpm dev` still uses ordinary `.env` configuration and `.data/crm`. Do not overwrite an existing `.env`. For a separate empty ordinary database: `pnpm db:migrate`, then `pnpm db:seed --synthetic 700`; seed refuses nonempty data. Do not use synthetic fixtures on client data.

PGlite executes PostgreSQL locally; no Docker or system PostgreSQL is required. Only one process may open a data directory. Stop that server before migrations, offline inspection or backup. Loopback binding is enforced. `NODE_ENV=production` deliberately fails. Hosting, secure-cookie configuration and external PostgreSQL require a separately approved staging/release plan.

Visits belong to the authenticated performer, with one open visit per executive and several executives allowed at the same shop. Visiting never transfers ownership. Managers/admins explicitly transfer shops or assign pending follow-ups with a reason and audit. Executives manage their own follow-ups. Duty is separate from visits. Reports use Asia/Dubai dates and distinguish visits started from visits completed, current pending follow-ups and recorded attendance. Authorization, audit, version checks and transaction safety remain enabled.

## Verify

```powershell
pnpm build
pnpm test
pnpm test:browser:phase3
pnpm review:reports:phase3
pnpm test:integrity
pnpm audit --prod
```

Automated suites and the five-width browser harness use disposable synthetic databases. `pnpm test:runtime:phase3` performs complete journeys **against the prepared demo on port 3100**, creating a fictional visit, follow-up and duty record, saving five-width screenshots and downloading all report types. It intentionally changes demonstration data.

Phase 2 reproduction evidence is under `evidence/phase3/before`; original evidence remains under `evidence/phase2`. Historical `test:browser`, `test:runtime` and `review:downloads` target Phase 2 paths/accounts. Do not use those runtime commands against the Phase 3 demo. `test:reference` requires the unchanged reference static server on port 8080.

## Owner review

- [Phase 4 acceptance report and next owner checkpoint](docs/PHASE4-ACCEPTANCE-REPORT.md)
- [Phase 4 demonstration checklist](docs/PHASE4-DEMONSTRATION.md), [real-phone human UAT](docs/PHASE4-PHONE-UAT.md)
- [Outstanding correction-policy decisions](docs/PHASE4-POLICY-DECISIONS.md)
- [Separate staging/security/backup plan](docs/PHASE4-STAGING-PLAN.md)
- [Phase 3 handoff, results and release blockers](docs/PHASE3-HANDOFF.md)
- [Executive and manager demonstration walkthroughs](docs/PHASE3-DEMONSTRATION.md)
- [Client acceptance checklist](docs/PHASE3-ACCEPTANCE.md)
- [Independent usability and safety review](docs/PHASE3-REVIEW.md)
- [Approved and outstanding business decisions](docs/DECISIONS.md)
- [Historical Phase 2 handoff](docs/PHASE2-HANDOFF.md)

No deployment, real import, production account creation, Zoho Books connection or main merge is part of this work. Invoicing, inventory, payroll, offline sync, account-recovery UI and missed-event corrections remain outside this candidate.
