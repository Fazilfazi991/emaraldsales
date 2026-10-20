# Phase 4 acceptance preparation and staging readiness report

20 October 2026. **Local engineering acceptance checks passed. Client/first-time-human and physical-phone acceptance are pending. Hosted staging is not ready or authorized.**

Verified starting branch/revision: `phase3/owner-review` at **`0b9ad20e554f1a89d9e94918588da44728df9ce1`**, with a clean working tree. The reported implementation commit `dddeb42fd0e826eb83a9ebf9e618dc429b7e534e` is its application-change ancestor. Work/delivery branch: **`phase4/acceptance-readiness`**. The exact Phase 4 delivery commit is reported in the final owner handoff; `git rev-parse HEAD` identifies the checked-out delivery snapshot.

## Deliverables and ownership

| Deliverable | Owner / result |
|---|---|
| This acceptance/integration report and new runtime/restore evidence | Coordinator |
| [Client demonstration checklist](PHASE4-DEMONSTRATION.md) and [short real-phone UAT sheet](PHASE4-PHONE-UAT.md) | Agent 1; all human fields remain unticked |
| [Outstanding business correction decisions](PHASE4-POLICY-DECISIONS.md) | Coordinator; proposals only, no unresolved policy implemented |
| [Separate staging, security, deployment and backup plan](PHASE4-STAGING-PLAN.md) | Agent 2; planning only, no resources or external connections |
| [Independent QA report](PHASE4-QA.md) and [QA evidence summary](../evidence/phase4/qa/summary.json) | Agent 3; fresh regression and independent report review |
| [Focused usability evidence](../evidence/phase4/usability/README.md) | Agent 1; ten role/width contexts, 51 screenshots, no operational write attempts |

Agents had separate documentation/evidence ownership and made no parallel feature edits. The coordinator reviewed and integrated the outputs. The [allocation and acceptance plan](PHASE4-PLAN.md) records scope.

## Changes made

**No application, interface, authentication, permission, reporting calculation, dependency, schema or migration changes.** Emerald's existing design, five simple destinations and backend behavior remain intact. Only documentation, reproducible verification scripts and new synthetic evidence were added; README links the Phase 4 handoff.

New scripts:

- `scripts/phase4-acceptance.ts`: genuine browser actions against the prepared synthetic local demo, adding one completed visit, one completed follow-up and one ended duty/break session. Refuses an already-open executive visit/duty rather than silently changing it.
- `scripts/phase4-local-restore.ts`: cold backup/restore verification using disposable synthetic databases; does not stop, copy or reset the running demo.
- `scripts/phase4-review-reports.py`: read-only inspection/hashing of the fresh native downloads.

The runtime test also creates/revokes local login sessions and records report-download audit events. Credentials and database files remain ignored; no passwords are included in the handoff/evidence. Phase 3/reference evidence is preserved.

## Available local acceptance conducted

Both roles used separate authenticated browser contexts on **http://127.0.0.1:3100/**. The runtime test used the existing synthetic accounts, actual HTTP APIs and persisted PostgreSQL/PGlite data, not mocked UI state.

| Requested journey | Observed local result |
|---|---|
| Executive sign-in / Start duty | Passed; separate duty session saved |
| Manager sees who is on duty | Passed while executive duty remained active; Show activity refreshed On duty |
| Shop search / check-in / outcome / checkout | Passed; Regular Visit and discussion saved to the authenticated performer's visit |
| Set follow-up / Complete | Passed; exactly one new independent follow-up, completion note and completed lifecycle saved |
| Refresh / fresh executive login | Passed; same visit ID and completed follow-up ID retained |
| Start break / resume / end | Passed; manager separately observed On break, On duty and Off duty after explicit refresh; one completed rest interval retained |
| Manager today / visits / follow-ups / customer history | Passed; pending item seen before completion and completed item seen afterward, with full shared history |
| Salesman/date filters | Passed; Ahmed and a two-UAE-date range selected; saved visit included and returned rows belonged to the selected performer |
| Excel/PDF downloads | Passed; eight native downloads: all-staff activity plus selected-executive activity, duty and follow-ups, each in both formats |
| Fresh manager login | Passed; completed shared visit/follow-up persisted |

[Runtime result](../evidence/phase4/runtime/result.json) records **11 grouped checkpoints, 17 layout captures, eight downloads and zero uncaught page errors**, including the saved record IDs and final states. It covers 390, 430, 768, 1024 and 1440 CSS pixels. The executive is left off duty; the new visit and follow-up are completed. Earlier independent tasks remain unchanged.

The downloaded reports are snapshots taken during the journey: duty was active and the new follow-up pending when those files were generated. Later completion/end events do not retrospectively change an earlier downloaded file. Fresh report requests read current saved state.

## Independent regression and usability review

| Check | Result |
|---|---|
| Frozen lockfile install / TypeScript and client build | Passed |
| Automated domain/API/export/security tests | **56 reported tests passed, 0 failed**; includes four parent suite entries and 52 leaf tests |
| Isolated five-width browser regression | **26 grouped checkpoints, 53 layout assertions, 35 native downloads**, zero uncaught browser errors / page-overflow failures |
| Unique regression screenshots | 48 PNGs; five repeated follow-up captures reuse filenames, so 53 assertions are not 53 unique images |
| Independent actual-app usability navigation | Ten fresh contexts, both roles at all five widths; no page errors, document overflow or attempted operational writes |
| Dependency audit | Zero known production dependency advisories at execution time |
| Original reference integrity | All ten supplied hashes match |

Regression covers authorization and organization boundaries, CSRF/Host/Origin protections, races, safe retries, repeated checkout, audit-write rollback, two executives visiting one shop, immutable history, explicit assignments/transfers, follow-up rescheduling/completion, repeated breaks, UAE date boundaries, persistence and report formatting. The 430px injected write failure is an expected recovery test, not an unresolved failure.

QA [source hashes](../evidence/phase4/qa/source-snapshot.json) remained unchanged for the captured files. A final Git comparison also confirms no application/client/migration/font/dependency/test modifications against the delivered baseline. These are local single-process engineering checks, not external PostgreSQL, staging load or human UAT results.

## Fresh Malayalam/Arabic report verification

The manager's new **all-staff activity** Excel/PDF comes from the actual synthetic database and contains Ahmed's Arabic name, Naseer's Malayalam name, the Malayalam shop name and accented Latin D’Souza/Démo text. XLSX strings and row counts were checked against saved report data. All four new PDFs were parsed for embedded fonts, Arabic text and UAE report context; the all-staff PDF also retained Malayalam and accented Latin. Its first page and the selected-duty page were rendered and inspected: shaped glyphs and wrapped cells are visible, with no observed missing-glyph boxes or overlapping cells.

See [fresh report review/hashes](../evidence/phase4/runtime/report-review.json), [all-staff Excel](../evidence/phase4/runtime/all-staff-activity.xlsx), [PDF rendering](../evidence/phase4/runtime/all-staff-activity.png) and [duty rendering](../evidence/phase4/runtime/selected-staff-duty.png). A native-language client speaker must still approve spelling, reading order and terminology; engineering visual inspection is not that approval.

## Backup/restore evidence and its limits

The coordinator executed an **isolated local cold-copy backup and independent restore**, not a hosted deployment. The final drill populated 700 fictional shops, 97 visits, six follow-ups, one ended duty/break session, eight audit events, seven idempotency entries and one hashed local session. It closed the writer, copied the database, compared **1,044 file hashes**, restored into a new directory, reapplied only checksum verification through the existing migrator, and matched all **14 table digests and 32 indexes**. Reopening the original temporary source confirmed it was unchanged. Temporary source/backup/restore directories were removed.

Final evidence: [restore/result.json](../evidence/phase4/restore/result.json), [log](../evidence/phase4/restore.log). Copy/open/verification took about 8.37 seconds; the complete synthetic drill took about 22.22 seconds on this machine. These are bounded local timings, **not a hosted RTO/RPO promise**. The initial drill harness used an incorrect table name and an invalid fixture enum, both rejected and corrected in the verification script; no application change or live-data correction was needed. The final drill passed.

Hosted encrypted backups, key recovery, point-in-time recovery, account/session revalidation after restore, provider failure, cutover, measured RPO/RTO and reconciliation remain **not run**. The staging plan specifies their future evidence and approval gates.

## Remaining usability observations

No blocking core-workflow defect was reproduced. Preserve these observations for actual staff acceptance:

1. **Duty minutes rounding (P3):** elapsed, rest and net are independently rounded to 0.01 minutes; totals sum rounded rows. Very short breaks can display zero while moving net by 0.01. An actual-method illustrative reproduction matches the observed 0.65 / 0 / 0.63 total. Raw timestamps/rest rows are retained; no integrity defect was reproduced. Separate XLSX/PDF requests during an active session also have different snapshot times. [Independent rounding review](../evidence/phase4/qa/rounding-review.json). Owner should accept the display or approve a small explanatory presentation note; do not change raw time calculations to force rounded arithmetic.
2. **Similar follow-up cards:** multiple items for the same shop/owner/due date show linked visit date but not visit time. Test that a new user can identify the intended item before completing it. No task was merged or erased.
3. **Desktop Today table:** far-right columns use internal scrolling beside follow-ups. The page fits, but human users should confirm status discoverability.
4. **Mobile branding:** the signed-in header has no compact Emerald logo/name; green identity and branded login remain. The existing design was preserved rather than redesigned.
5. **Manager freshness:** Duty now is a saved snapshot; staff must use Show activity to refresh. This is explicit in the checklist, not a live-feed claim.

## Run and review

From `development`, keep the prepared demo running with `pnpm demo:start` if it is not already running. Do not run demo:prepare again or start a second listener. Private synthetic credentials remain in `.local/phase3-demo-accounts.json`.

```powershell
# Independent regression into a new evidence directory:
$env:PHASE3_EVIDENCE='evidence/phase4/qa/browser'
pnpm test:browser:phase3

# Prepared-demo acceptance: intentionally adds synthetic activity:
pnpm exec tsx scripts/phase4-acceptance.ts

# Isolated synthetic cold-copy restore (does not touch demo DB):
pnpm exec tsx scripts/phase4-local-restore.ts
```

`phase4-review-reports.py` uses Python with pypdf; this Codex machine's bundled Python was used. No new application dependency was installed. Raw TAP, commands, screenshot indexes and hashes are linked in the QA/usability reports. Real phones cannot reach this host's loopback URL directly; follow the [secure access prerequisite](PHASE4-PHONE-UAT.md), without weakening the local Host/Origin/authentication protections.

## Next owner approval checkpoint — stop here

| Gate | Owner decision / remaining blocker |
|---|---|
| Client acceptance | Name first-time executive/manager testers; execute the unticked demonstration/phone checklist. No client acceptance is claimed. |
| Corrections | Decide forgotten checkout, wrong duty times, missed return, mistaken customer/void authority and overnight/reporting questions in the policy sheet. No unresolved correction is implemented. |
| Presentation | Review rounding, same-date follow-up identification, terminology/languages and minor layout observations. Any change should be a separately agreed small fix. |
| Staging authorization | Select provider/account, region/residency, domain, budget, access roster and operating owner; approve exact implementation/provisioning scope before any resource creation or connection. |
| Staging implementation | Network PostgreSQL adapter/migrator, hosted configuration, recovery/offboarding, restricted DB grants, secrets/HTTPS, monitoring, Chromium capacity and safe rollback need implementation and rehearsal after approval. |
| Recovery/privacy | Approve proposed loss/downtime targets, retention, key/recovery operators and data/export/GPS access. Pass the hosted restore/security/load rehearsals; local copy evidence is insufficient. |
| Import and production | Import tooling and exact source/mapping/batch approval remain absent. No real import, production account, production/main merge, Zoho connection or deployment is authorized. |

Review of this report or approval of a planning proposal does not itself authorize infrastructure or production operations. Phase 4 stops at this checkpoint.
