# Local foundation handoff — 20 October 2026

## Delivered behavior

The source-verified Emerald demo is preserved under `reference/` with its supplied HTML hash and all manifest hashes matching. A separate development application retains the five modules and responsive interface, adds supplied logo branding, replaces simulated identity/localStorage with real local accounts, server sessions and disk-backed PostgreSQL, and provides a populated executive experience.

The candidate vertical slice implements authenticated server-side shop search/shared history → owner check-in → required discussion/outcome/order-interest checkout → owned follow-up → manager visibility. Atomic retries/races, assignment preservation and append-only auditing are implemented. **Operational visit/follow-up writes remain unavailable while D03 awaits a user response.** Search/history, plain executive discovery, manager views, account API and approved duty controls are available. Test harnesses explicitly exercise the candidate write policy in isolated temporary databases; they do not approve or enable it in the running workspace.

Duty uses separate server-timed sessions/rests with own executive controls and manager team history. It never changes shop visits. The local database contains 700 synthetic shops, three executives and separate manager/admin accounts with random passwords in `.local/accounts.json`.

## Changed files and commits

Branch: `development/foundation`. Commits: `8cf1dd5` source snapshot, `140219e` byte-preserving reference attributes, `8dd6095` application foundation, `91955c4` readable TypeScript formatting. The final verification/documentation commit is available in `git log --oneline`. No remote push was performed.

- `src/`: HTTP/session/auth, domain validation and UAE dates, transactional workflows, persistence adapter, synthetic fixtures and configuration.
- `migrations/`: versioned relational schema, referential and partial uniqueness constraints, append-only audit.
- `client/`: preserved CSS/navigation/page structures, typed client entrypoint, real sign-in, forms, errors, pagination, separate duty controls and attached logo.
- `scripts/`: migration/seed/account CLI, deterministic reference capture, integrity check, isolated browser harness, build and Windows command wrapper.
- `tests/`: domain, real HTTP API and on-disk database verification.
- `fixtures/`: synthetic reference fixtures, separate from customer records.
- `docs/`, README and `.env.example`: requirements/decision/evidence, architecture/API, setup, migration/import/release plans.
- `evidence/`: raw TAP, JSON results and reference/development screenshots. No passwords, cookies, real customer data or environment secrets are included.

Exact setup and migration commands are in [README](../README.md). This machine used Node 22.22.0 and bundled pnpm 11.25.0. The build command type-checks and builds the browser bundle. Migrate and seed were actually run against the prepared local directory. Docker's engine was unavailable; no Docker/system PostgreSQL/hosted database tests are claimed.

## Executed evidence

| Check | Result / evidence |
| --- | --- |
| Original reference integrity | All 10 supplied manifest entries match; `integrity.json` |
| Original browser baseline | 36 shops, 8→9 Al Noor visit journey, five pages captured, mobile shops, confirmed identity listener defect; `baseline.json` |
| Strict TypeScript + bundle | `pnpm build` passed |
| Domain/database/HTTP suite | `pnpm test` passed: 21 reported tests (20 scenario groups plus parent); exact results in `domain-api-tests.tap` |
| API security | Missing/expired/revoked session, invalid password, Origin/CSRF, manager write, another executive's checkout/follow-up/duty, admin-only accounts checked |
| Atomic workflows | Duplicate key replay, changed payload key rejection, competing check-ins, checkout races, lead+check-in rollback, immutable completed visit, assignment/follow-up preservation checked |
| Dates/duty | UAE midnight/exclusive date range, leap/invalid dates, overnight duty/rest, repeated rest and invalid transitions checked |
| Persistence/recovery | Database close/reopen and second authenticated session; stopped-database copy opened at separate restore path; single-directory process lock checked |
| Browser → API → PostgreSQL → UI | Executive login, shared shop history, check-in/checkout/follow-up, direct SQL saved-row assertion, reload, separate manager session, denied manager write; `browser.json` |
| Mobile UI | Five modules at 390px, discovery+immediate visit, checkout form, duty start/rest/return/end; no page overflow; screenshots `development-*-390.png` |
| Save acknowledgement loss | Browser request reached server and response was deliberately aborted; form remained, retry reused key, completed one visit; browser evidence |
| Safe rendering / browser health | Injected HTML rendered as text, no executable record images; no page exceptions or CSP violations in browser harness |
| Prepared runtime | Actual port-3100 sign-in/sign-out and visit-write POLICY_PENDING response verified; duty approved-v1 and visit pending confirmed in `local-runtime.json`; screenshot `development-current-policy-pending-1440.png` |
| Client acceptance | **Not performed**. Developer checks and synthetic screenshots are separate from client UAT |

Screenshots to review first: [original dashboard](../evidence/reference-dashboard-1440.png), [development dashboard](../evidence/development-dashboard-1440.png), [shop history](../evidence/development-shop-history-1440.png), [manager history](../evidence/development-manager-history-1440.png), [mobile checkout](../evidence/development-checkout-390.png), [mobile duty/rest](../evidence/development-duty-rest-390.png), [mobile discovery](../evidence/development-new-shop-390.png).

The original machine-specific full-site acceptance script was not run. Real-device GPS success/accuracy, actual phones/keyboards, external PostgreSQL, multiple application processes, production performance, hosted backup recovery, account recovery, real imports, Zoho connectivity and client acceptance are unverified.

## Remaining work and next task

Resolve D03 (single open visit per executive/shop; visitor-owned follow-ups preserved until explicit action). If approved, record it, enable the local visit policy and rerun the user-side browser journey; otherwise adapt the candidate service/index rules deliberately. Do not silently bypass the gate.

Next implementation task after that decision: use [the UAT checklist](UAT.md) to review the populated executive and manager experience with the client, specify missed duty/visit corrections and shop transfer/conversion rules, then implement the permitted audited correction workflow. Retain explicit unavailable operations until those rules exist. Import staging and account lifecycle UI follow their specified policies. Hosting/provider/region/domain and production release remain separate decisions.
