# Minimum Vercel staging preparation

20 October 2026. Base `9296cf36c94173e418abf1e57a367bdb48c3ff8c`; preparation branch `prep/vercel-staging`.

**Owner checkpoint: local preparation only. No hosted database, credentials, infrastructure, service connection, Vercel settings, push or deployment was created or changed.** This prepares a dedicated synthetic staging CRM, not real-client production use. The original `config()` production guard remains unchanged. A separate, explicit hosted staging gate is closed until approved configuration is supplied.

Publication follow-up: `7c7b95b3a47e53d69d3c0911dc4a94b7628ca90f` is the verified implementation commit. A separate publication-safety commit sets `git.deploymentEnabled=false` in `vercel.json` because this repository is already connected to Vercel. This prevents automatic Git deployments while the staging branch and PR are reviewed; it does not change application behavior or cloud settings. Keep automatic deployment disabled until the owner approves infrastructure and release. [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).

## What changes

- Export a lightweight Node request handler from root `server.ts`, which lazily loads hosted initialization; retain the existing local listener, screens, routes and access rules in `src/server.ts`. Reuse the same application handler in both environments. See the [runtime investigation and replacement checklist](VERCEL-RUNTIME-FIX.md) for the subsequently verified browser-bundle entrypoint collision and its correction.
- Add a bounded PostgreSQL pool: maximum three connections per warm instance, five-second connection/lock limits, fifteen-second server statement limits and twenty-second idle-transaction limits. All transaction statements stay on one checked-out connection. Transaction-local settings avoid session-state leakage through a transaction pooler. Connection/commit failures are not automatically replayed; existing same-key mutation retries remain authoritative.
- Require TLS chain and hostname verification. A provider CA can be supplied when required. URL SSL/options overrides are rejected; do not use `rejectUnauthorized=false` or disable certificate verification to make a provider connect.
- Keep database schema creation outside the request path. Operator migrations take a transaction advisory lock, verify existing checksums and apply trusted SQL atomically. Hosted startup checks the complete known migration set without modifying it.
- Require a restricted runtime role and the dedicated synthetic workspace. Runtime cannot own the audit table, inherit its owner's role, create public-schema objects, alter audit rows or modify migration records. Existing server authorization, CSRF, exact Host/Origin checks, secure HttpOnly cookies, idempotency, version checks and audit triggers remain enabled.
- Use Vercel's overwritten client-IP header only in the explicit hosted runtime; local mode continues using the socket address. A missing/malformed trusted IP prevents sign-in rather than bypassing throttling. Hosted logs contain request IDs and safe failure stages, without database messages or customer/request contents.
- Package pinned serverless Chromium 153 and matching Playwright Core 1.63 for PDF generation, with the existing bundled fonts, escaping, disabled page JavaScript, blocked page networking and concurrency guard. Keep the existing locally verified Playwright 1.64 renderer for local use. No external PDF service or runtime browser download is introduced.
- Pin Node to `22.x`, retain TypeScript `6.0.3`, explicitly include assets/migrations/browser files and exclude private local files from the function. No new database migration file or business correction policy is introduced.

## Database setup needed

Use **one separate managed PostgreSQL 17 staging database**, with TLS and a provider-supported transaction pooler for application traffic. Use its direct endpoint for operator migrations. It must be separate from any future production database. No provider is selected or connected by this preparation.

The provider must allow two separate non-superuser login roles:

| Role | Purpose | Stored where |
| --- | --- | --- |
| `emerald_migrator` | Owns the staging schema/tables and runs reviewed migrations/bootstrap | Operator secret storage only; never Vercel runtime |
| `emerald_runtime` | Only the grants in `operations/staging-grants.sql`; no owner-role membership, superuser, role creation, database creation or RLS bypass | Vercel environment secret `DATABASE_URL`, using the pooler |

Database-level CONNECT rights and role creation/passwords belong to provisioning, not the grants template. Run migrations as `emerald_migrator`, then review/apply `operations/staging-grants.sql` as the appropriate owner. Future tables need explicit reviewed grants; there are no automatic future-table write grants. The runtime's column UPDATE grants on membership role and user active status are required for PostgreSQL's joined authorization row locks; the HTTP permissions still control actual changes.

Choose the database and Vercel execution region together. The failing deployment's build logs show `iad1` (US East), while its actual function logs show `bom1` (Mumbai); build location does not establish execution or database location. Neither location is approved for client data. Confirm location and monthly budget before provisioning. Pooler limits must account for all warm instances and operator connections; three per instance is not a global connection cap. Provider-specific pooler, custom-role and TLS behavior still require testing after approval.

For staging, approve backup retention and recovery responsibility before use: propose at least daily encrypted backups with seven-day retention and one tested restore to an isolated database. Enable point-in-time recovery only on an explicitly approved plan/budget. Provider backup/restore has not been tested. Real-client use remains blocked until recovery targets, privacy/access and account-recovery operations are approved and verified under the earlier [staging plan](PHASE4-STAGING-PLAN.md).

## Configuration after owner approval

The existing Vercel project `development` may serve as synthetic staging even though its Git integration labels main deployments as the platform's “Production” target. This does not authorize business production or real data. Do not reuse these secrets for a future production project, or copy them to unrelated preview branches.

Set only in the specifically approved staging environment:

| Variable | Value / handling |
| --- | --- |
| `CRM_HOSTED_STAGE` | `approved-synthetic-staging` — explicit release gate |
| `APP_ORIGIN` | One approved exact HTTPS origin, without trailing slash; no automatic trust of preview aliases |
| `DATABASE_URL` | Restricted runtime role's pooler URL, privately configured in Vercel; no query parameters, or only `sslmode=verify-full` |
| `DATABASE_SSL_CA` | Provider PEM CA only if its certificate requires it; otherwise use the system trust store |
| `VISIT_POLICY` | `approved-v2` |
| `DUTY_POLICY` | `approved-v1` |
| `NODE_ENV`, `VERCEL` | Platform supplies `production`, `1`; do not bypass checks by setting development mode |

Secure cookies are forced on in the hosted configuration. `HOST`, `PORT`, `DATA_DIR` and `COOKIE_SECURE=false` from local `.env` are not hosted inputs. No PGlite/disk fallback exists in hosted mode. Unsupported configuration, privileges, workspace or schema returns a no-store 503 with a request ID. Startup logs identify `configuration`, `database_connection`, `schema_verification`, `runtime_permissions` or `synthetic_workspace` without exposing connection details.

Privately prepare an ignored `.local/staging-operator.env` on the operator machine, containing `MIGRATION_DATABASE_URL` (direct endpoint), any required CA, `CRM_HOSTED_STAGE=approved-synthetic-staging`, and **only when approved** `CONFIRM_STAGING_MIGRATION=yes`. Never commit, print or paste the URL/password into chat or a command line. Then run from `development`:

```powershell
node --env-file=.local/staging-operator.env --import tsx scripts/staging-migrate.ts
```

After explicit permission for **synthetic accounts and shops**, add `CONFIRM_STAGING_SEED=yes` privately and run:

```powershell
node --env-file=.local/staging-operator.env --import tsx scripts/staging-seed.ts
```

This uses the existing empty-database-only fixture generator: 700 fictional shops and five demo accounts with random passwords. It refuses existing users and refuses to overwrite `.local/staging-accounts.json`. Credentials stay in that ignored file and must be delivered privately to named testers. Do not rerun blindly after an uncertain outcome or a credentials-write failure. No production account or real customer import is authorized. No recovery-email service, SSO, storage service or Zoho connection is required for this synthetic trial.

Use Vercel deployment protection where available for named testers, in addition to CRM sign-in. Confirm the plan/cost/access implications before changing it. Restrict the staging URL to the approved tester group; a public source repository is not approval for public demo passwords.

## Local verification and remaining checks

Verification uses Node 22.22.0, pnpm 11.25.0 and an isolated PostgreSQL 17.11 cluster bound to `127.0.0.1:55437`. A two-day test certificate/private key lives only under ignored `.local/vercel-pg-test`; no external database was contacted. The existing local demo database is unchanged.

- Frozen dependency installation and TypeScript/client build pass.
- Regular suite includes all earlier domain/API/report tests plus hosted configuration, TLS override rejection, trusted-proxy behavior, unchanged production guard, default-handler closed-gate response and browser package compatibility.
- The PostgreSQL integration suite verifies trusted/untrusted/wrong-host TLS, simultaneous migration runners, restricted runtime grants, workspace restriction, independent backend connections, rollback, authenticated sessions, CSRF/origin/role enforcement, visit races, cross-owner denial, failed checkout and concurrent same-key retry, follow-up lifecycle, duty/break/return/end, logout/fresh login, manager reports, native local Excel/PDF and checksum drift.
- A separate local process executes the actual exported hosted entrypoint with TLS PostgreSQL, serving the login page, secure-cookie login, authenticated shop search and native Excel; hostile Host is rejected. Its HTTP test harness emulates the trusted ingress. This is not a deployed HTTPS/browser test.
- `pnpm audit --prod`: zero reported vulnerabilities at preparation time.

Preparation checks: **61 reported regular tests passed** (57 leaf tests plus four parent entries); **14 reported PostgreSQL tests passed** (13 leaf tests plus one parent entry). Zero failed, cancelled or skipped. Build and frozen install passed. The production dependency audit reported zero vulnerabilities; the staged Gitleaks scan reported zero findings. The temporary local PostgreSQL cluster was stopped after verification. No screenshots were changed because this patch changes no screen design. Subsequent runtime-fix checks and limitations are recorded in [VERCEL-RUNTIME-FIX.md](VERCEL-RUNTIME-FIX.md).

Reproduce the separate integration suite only against a **disposable loopback** PostgreSQL instance with a trusted localhost server certificate. Set `CRM_LOCAL_PG_TEST_URL` to its administrator URL and `CRM_LOCAL_PG_TEST_CA` to that certificate, then run `pnpm test:postgres`. It creates and drops its own random database/roles; remote URLs are rejected. `pnpm test` uses disposable embedded databases and does not require network PostgreSQL.

**Not verified at preparation time:** a complete Vercel build artifact, Linux Chromium execution/font output on Vercel, provider-specific pooler behavior, hosted HTTPS/proxy cookies and real-phone journeys, provider backup restore, production identity recovery, or real-client acceptance. The subsequent runtime fix verifies the official Node builder's output on Windows, with explicit limitations in its report. No physical-phone testing is claimed. After approval, test a restricted synthetic deployment before inviting users: cold/warm startup, all five widths, fresh login, duty/visit/follow-up journey, same-key mobile retries, two executives at one shop, manager filters and all Excel/PDF reports including Arabic/Malayalam. Measure PDF cold start, concurrent workload, duration, memory and connection use before increasing access.

## Owner approvals required before connection or release

1. Database provider/account, staging-only scope, region, monthly budget and backup plan.
2. Creation of the isolated database and the two restricted roles; permission to run the existing migrations, grants and synthetic seed.
3. Exact staging HTTPS URL, approved testers, private account delivery and deployment-protection choice.
4. Permission to configure the scoped Vercel secrets and region/runtime settings, then push/deploy this reviewed commit for staging verification.

The previous approval to push the TypeScript correction does not authorize this hosted implementation or new services. Do not paste passwords or connection strings into chat. No service will be connected until the relevant approvals are explicit.

If deployment fails, keep the approval gate closed, preserve the database and inspect the sanitized failure stage. Code rollback requires schema compatibility review; runtime startup rejects unknown migration sets. Revoke the staging gate and redeploy to disable hosted access. Do not automatically restore over a live database or rerun seeds as rollback. Keep existing local demonstration access available while hosted acceptance is pending.
