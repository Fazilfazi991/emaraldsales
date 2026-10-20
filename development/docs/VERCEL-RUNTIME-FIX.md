# Vercel function runtime investigation

20 October 2026. Source branch `fix/vercel-function-entrypoint`, based on `825db7a09a07e9053b1f48a898ad2e6b5cb60332` (`prep/vercel-staging`). This is a source correction for owner review. No deployment, main merge, cloud configuration, database provisioning, hosted migration, hosted seed or service connection was performed. Git deployments remain disabled in `vercel.json`.

## Confirmed failure

The live alias was serving deployment `dpl_7HYdjP8TYFCctHsvUiD9KsiU9rb2`, Git `main` commit `9296cf36c94173e418abf1e57a367bdb48c3ff8c`. Actual runtime logs returned a matching stack for the request visible in the owner's screenshot:

```text
2026-10-20T13:35:33.060Z GET /
request=6dtlp-1792503332443-0d74065e5825
environment=production region=bom1 runtime=nodejs24.x
ReferenceError: document is not defined
    at $ (/var/task/app.js:19986:26)
    at Object.<anonymous> (/var/task/app.js:20584:1)
Node.js process exited with exit status: 1
```

This investigation obtained matching runtime evidence after an earlier query had returned none. No missing stack was inferred. The immediate failure is **browser code running as the function during module loading**, before configuration validation, database initialization or request handling. The local-only production guard is another reason old main cannot serve hosted CRM, but it is not the first exception in these logs.

Build logs show Vercel CLI `64.3.1`, successful application build, TypeScript `6.0.3`, and `Using src/server.ts as the root entrypoint`. The final message is insufficient to prove which handler was packaged. The official published `@vercel/backends@19.0.2` implementation searches generated `dist`, `build` and `output` for generic server names after the build command. `dist/app.js` wins as precompiled server output and replaces the correctly discovered source handler. That file is our browser client.

Read-only dashboard inspection confirmed Root Directory `development`, Framework Preset `Node`, Node.js `24.x`, and disabled build/install/output overrides. No dashboard setting was changed. The Git deployment file-tree endpoint returned 404, so no direct inspection of that deployed artifact is claimed.

The same official builder, run offline against the unchanged staging preparation, emitted handler `app.js`, runtime `nodejs22.x`, 25 files. Executing it under Node `22.22.0` reproduced `document is not defined` at the same two client-code line numbers. Changing Node alone therefore does not resolve this collision. Primary implementation inspected: [published backend package](https://registry.npmjs.org/@vercel/backends/-/backends-19.0.2.tgz), SHA-256 `90acacc5ac99371ea844837453073b5aef90289a4ecfc311b5bbcd7597e5f2a8`.

## Minimal correction

| Files | Change |
| --- | --- |
| `scripts/build.mjs`, `src/server.ts` | Generate `dist/emerald-client.js`; continue serving it at existing `/app.js`. Remove the known obsolete generated `dist/app.js` and fail on other cached server-looking output names. No client screen or workflow changes. |
| `server.ts`, `src/unavailable.ts`, `src/hosted.ts` | Lightweight default Node handler with lazy application import. Catch module-loading failures and uncaught handler failures when headers can still be sent. Return no-store 503 with request ID; browsers receive a plain Emerald unavailable page, APIs retain `STAGING_UNAVAILABLE`. Logs contain a safe stage and request ID only. |
| `vercel.json`, `tsconfig.json` | Point function configuration/typechecking at root `server.ts`. Keep 60-second limit, explicit assets, exclusions, Node 22 pin, TypeScript compatibility version and Git deployment block. |
| `tests/build-entrypoint.test.ts`, `tests/hosted.test.ts`, `tests/postgres.integration.ts` | Cached-output regressions, HTML/JSON/HEAD closed-gate checks and optional compiled-artifact integration execution. |

No schema migration was added or changed. Authentication, authorization, TLS verification, policy approvals, schema checksums, restricted runtime grants, synthetic workspace checks, audit behavior and request idempotency remain enforced. A module failure after response headers cannot be converted to a new 503; the incomplete connection is terminated. Corrupt platform bootstrap code or the lightweight handler's own module still lies outside its catch boundary.

## Verification and practical limits

| Check | Result |
| --- | --- |
| Node 22 TypeScript/client build | Passed |
| Regular suite | 63 reported tests passed: prior 61 plus two build regressions; zero failed/cancelled/skipped |
| PostgreSQL source suite | 14 reported tests passed; disposable loopback PostgreSQL 17.11 only |
| PostgreSQL suite with compiled artifact | Same 14 tests passed in a Git-export fixture; no tsx loader in the artifact subprocess |
| Official backend build output | `server.mjs`, `nodejs22.x`, 60 seconds, 1,583 files |
| Artifact package contents | Client files, three migrations, bundled TTF fonts and Chromium binary present; private local data/env/tests excluded |
| Standalone artifact, approval missing | HTML/JSON/HEAD return 503, no-store and sanitized `configuration` stage |
| Standalone artifact, application module deliberately missing | HTML/JSON/HEAD return controlled 503 with sanitized `module_loading` stage; disposable file restored afterward |
| Compiled handler with TLS local synthetic database | Login page, public client assets, secure-cookie sign-in, authenticated shop query and native Excel; hostile Host rejected |
| Local full API journeys | Separate accounts, duty/break/return/end, visit race/checkout/retry/rollback, follow-up lifecycle, fresh sign-in, manager reporting, native Excel/PDF and authorization checks passed |

The official Node builder (`@vercel/backends@19.0.2`, `@vercel/build-utils@14.21.2`) was invoked locally; this is not a full cloud `vercel build` or a deployed artifact execution. Its traced output was materialized in a temporary directory outside the repository so dependencies could not fall back to project `node_modules`. Windows directory junctions represented the builder's internal package symlinks; existing explicitly included directory contents were merged from traced files. No source dependencies were added for this diagnostic harness. Node 22 executed the handler; the local pnpm wrapper reports its own Node 24 launcher, which does not change the artifact runtime metadata.

An initial artifact/database check returned controlled 503 because the old Windows working-copy migration files used CRLF while the Git export packaged LF. This is the intended checksum guard. The complete suite passed when fixture migration execution used the exact exported SQL bytes packaged with the artifact. Do not edit migration rows or bypass checksum verification to repair an existing database; investigate and approve its migration provenance instead.

Linux execution was explicitly skipped at the owner's request. Linux Chromium/PDF execution, Arabic/Malayalam report output on Vercel, Linux symlink behavior, provider-specific pooling, hosted HTTPS/proxy behavior, full hosted browser journeys, cold/warm PDF capacity and backup restore remain unverified. Local PDF tests use the existing Windows renderer; presence/version matching of the Linux binary does not prove execution. Existing responsive/client evidence was not rerun as a hosted acceptance claim.

## Safe replacement steps requiring owner approval

1. Review the linked fix PR into `prep/vercel-staging`, then review draft PR #1 into `main`. Merge only after owner approval; do not force-push. Keep `git.deploymentEnabled=false`. The old alias continues to fail until a separately approved deployment replaces it.
2. Review Vercel settings: Root Directory `development`, Framework `Node`, Node `22.x`, normal package build command, no browser output-directory override. Source `engines.node=22.x` is retained. Align the current project setting from 24 to 22 only with approval. Do not point the function at `dist/emerald-client.js` or set `dist` as a static-only application output.
3. With separate deployment permission, build an isolated preview from the reviewed SHA, initially with hosted approval/configuration absent. Verify controlled 503 and sanitized logs; this is the expected safe closed state, not a functional CRM or acceptance success. Do not assign the live alias.
4. Obtain approval for a dedicated **synthetic staging** PostgreSQL 17 provider/account, region, budget, backup retention/tested restore, tester access and exact HTTPS origin. Provision separate migrator/runtime roles and verify provider TLS/pooler support. The runtime role must not own schema/audit objects or inherit the migrator. No database was connected by this fix.
5. Separately approve operator migrations, grants and synthetic seed. Use reviewed existing `staging:migrate` / `staging:seed` instructions and the exact committed migration bytes. Keep migrator credentials off the function. Privately configure scoped `DATABASE_URL`, optional `DATABASE_SSL_CA`, `APP_ORIGIN`, `CRM_HOSTED_STAGE=approved-synthetic-staging`, `VISIT_POLICY=approved-v2`, `DUTY_POLICY=approved-v1`. Never disable TLS checks or reuse local account files. See [staging preparation](VERCEL-STAGING-PREPARATION.md) for commands and role grants.
6. On the approved restricted preview, run Linux PDF and Arabic/Malayalam export checks; verify real HTTPS sign-in/cookies, shop search, duty, visits, follow-ups, manager filters, Excel/PDF downloads, refresh/fresh login, retries, concurrent requests and all five screen widths. Verify cold/warm startup, memory/time/connection limits and a backup restore. Complete human acceptance separately.
7. Obtain explicit approval before promoting the verified deployment to `development-alpha-smoky.vercel.app`. Preserve the database during rollback and review schema compatibility. Reverting only to local-only main would restore the known failure, not a safe working hosted CRM. New services, automatic deployments, real accounts/client data and Zoho remain outside this task.

Reproduce regular checks from `development` using Node 22: `pnpm build`, `pnpm test`. The separate `pnpm test:postgres` requires `CRM_LOCAL_PG_TEST_URL` and `CRM_LOCAL_PG_TEST_CA` for an explicitly disposable loopback cluster; it creates and drops temporary roles/databases. Optional `CRM_VERCEL_ARTIFACT_DIR` selects an already materialized Node-builder artifact with `artifact-metadata.json` containing `handler` and `runtime`; run that mode from a clean Git-export fixture with identical migration bytes. No hosted database URL is permitted by the integration harness.
