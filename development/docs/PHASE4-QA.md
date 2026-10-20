# Phase 4 independent QA and regression

Executed 20 October 2026 against `phase4/acceptance-readiness`, source revision `0b9ad20e554f1a89d9e94918588da44728df9ce1`. Node `v22.22.0`, pnpm `11.25.0`. Result: all automated checks below passed; no integrity failure was reproduced. A subsequent bounded review identified one P3 presentation-rounding observation for owner acceptance, recorded below. This report covers the independent QA run, not owner/client acceptance or production authorization.

## Reproduction and evidence

All new evidence is under [evidence/phase4/qa](../evidence/phase4/qa/). [summary.json](../evidence/phase4/qa/summary.json) records commands, counts, source revision, environment, and SHA-256 hashes for every downloaded file. [source-snapshot.json](../evidence/phase4/qa/source-snapshot.json) records source, script, test, and bundled-font file hashes. Rehashing after the run found zero changes in the captured files.

| Check | Actual result | Raw evidence |
|---|---|---|
| `pnpm install --frozen-lockfile` | Exit 0; lockfile accepted | [install.log](../evidence/phase4/qa/install.log) |
| `pnpm build` | Exit 0; TypeScript and client build passed | [build.log](../evidence/phase4/qa/build.log) |
| `pnpm exec tsx --test --test-reporter=tap tests/*.test.ts` | 56 tests passed; 0 failed, cancelled, skipped or todo; 84.65 seconds | [tests.tap](../evidence/phase4/qa/tests.tap) |
| `pnpm audit --prod --json` | Exit 0; 0 information/low/moderate/high/critical vulnerabilities; metadata reports 193 dependencies | [audit.json](../evidence/phase4/qa/audit.json) |
| Reference manifest integrity | 10 of 10 SHA-256 hashes matched | [integrity.json](../evidence/phase4/qa/integrity.json), [log](../evidence/phase4/qa/integrity.log) |
| Five-width Phase 3 browser regression | Exit 0; 26 grouped checkpoints, 0 uncaught browser errors | [browser.json](../evidence/phase4/qa/browser/browser.json), [log](../evidence/phase4/qa/browser.log) |

The explicit TAP command uses the same test runner and test glob as `pnpm test`, with its reporter selected to preserve raw TAP. Reference integrity evaluated the existing script with only its generated output destination redirected into the QA folder; neither the script nor the tracked `evidence/integrity.json` was edited.

## Browser coverage and exact counts

Ran `pnpm run test:browser:phase3` with `PHASE3_EVIDENCE=evidence/phase4/qa/browser`. The harness created a temporary isolated database, migrated and seeded that temporary database, served it on a temporary loopback port, and removed it after the run. It did not open, seed, reset or change the running `.data` database.

| Measure | Actual |
|---|---|
| CSS viewport widths | 390, 430, 768, 1024, 1440px |
| Grouped checkpoints | 26 passed |
| Layout assertions | 53 |
| Page-overflow failures | 0 |
| Unique saved screenshots | 48 PNG files |
| Download assertions / actual downloaded files | 35 / 35 |
| Excel downloads | 20 XLSX |
| PDF downloads | 15 PDF |
| Uncaught browser errors | 0 |

There are five fewer unique PNG files than layout assertions because the harness captures the `manager-followups` state twice at each width using the same filename. These are 53 assertions and 48 distinct image files, not 53 distinct screenshots. The seven downloads per width are one direct visible-filter Excel report and Excel/PDF pairs for activity, duty and follow-ups.

At every width the regression exercises executive login, active filters and clearing, duty start, shop search/profile, check-in, completed checkout, independent follow-up creation, rescheduling, completion, three break/return intervals, duty end, refresh, fresh account login and logout. Manager coverage includes attendance/activity/pending views, follow-up report, selected executive/date scope, persisted reload, and Excel/PDF downloads. Workbook assertions compare filtered activity rows and date context against saved report data; duty assertions check every accumulated break-history row.

Additional checkpoints cover two executives visiting the same shop independently; lost checkout acknowledgement followed by safe retry with exactly one follow-up; transaction rollback after an injected audit-write failure followed by successful retry; executive self-assignment for a newly added shop; manager follow-up reassignment; and an explicitly confirmed, audited shop transfer that preserves existing visit/follow-up history. The `QA browser synthetic database failure` log entry is the deliberate 430px failure-recovery test, not an unexplained failure. Untrusted note text remains non-executable.

The engine is desktop Microsoft Edge driven by Playwright with emulated CSS viewport widths. No physical Android, iPhone or tablet was tested. Scripted label-based tasks do not establish first-time human usability, mobile keyboard/touch behavior, GPS permission behavior, operating-system download handling or client language acceptance. Independent screenshot spot checks of the new 390px manager overview and checkout found no additional visible defect.

## Text and multilingual evidence

[text-review.json](../evidence/phase4/qa/text-review.json) records a strict UTF-8 scan of 35 source/script/test files: 0 invalid byte sequences, 0 replacement-character occurrences and 0 common mojibake markers. This mechanical scan is a targeted detector, not a universal proof of all text correctness.

Read-only review of the retained Phase 3 multilingual samples found all nine Arabic, Malayalam and accented-Latin workbook cells equal to their exact expected source strings. The existing activity PDF and first page of the 75-record, five-page sample were freshly rendered with Poppler into [unicode-activity-review.png](../evidence/phase4/qa/unicode-activity-review.png) and [unicode-multipage-first-review.png](../evidence/phase4/qa/unicode-multipage-first-review.png). In those inspected pages Arabic and Malayalam glyphs are shaped and visible, mixed Latin/numeric context remains present, and no replacement boxes, clipped cells or overlapping text were observed. Source and retained-sample hashes are recorded in the JSON.

These are retained synthetic Phase 3 samples inspected during Phase 4, not new multilingual downloads from the running application. Fresh multilingual exports, the complete business journey and live on-duty states belong in the coordinator's separate Phase 4 runtime acceptance evidence. Native-language spelling and reading-order approval remains on the client UAT checklist.

## Preservation and remaining acceptance

QA wrote only this report and `evidence/phase4/qa/`; it made no application/source edits and no commits. A final tracked diff check found no changes to Phase 3 evidence, `evidence/integrity.json`, application source, existing scripts/tests/assets, package manifest or lockfile. Earlier evidence remains available as recorded.

Independent engineering regression is complete with zero failed checks. The [phone UAT checklist](PHASE4-PHONE-UAT.md), [policy decisions](PHASE4-POLICY-DECISIONS.md), and staging readiness work remain separate acceptance gates. Physical-device testing, first-time staff use, client language approval and owner decisions must retain their actual pending status until executed by the intended people.

## Subsequent bounded P3 report observation

The coordinator's fresh runtime duty PDF shows 0.65 recorded duty minutes, 0 displayed rest minutes and 0.63 duty-less-rest minutes. Independent source inspection and an actual-method reproduction establish that this is a presentation-rounding issue, not a reproduced integrity failure. [rounding-review.json](../evidence/phase4/qa/rounding-review.json) records source/artifact hashes, observed values and a reproducible read-only call to `Reports.dutyDurations`; [rounding-review.mjs](../evidence/phase4/qa/rounding-review.mjs) can be run with `node --import tsx evidence/phase4/qa/rounding-review.mjs`.

The method unions and clips raw millisecond rest intervals, subtracts raw rest from elapsed duty, then rounds duty, rest and net independently to 0.01 minute. Export totals sum the rounded row metrics. A positive rest below 300ms displays as zero but can move the rounded net down 0.01 minute. Constructed inputs to the actual method reproduce the exact visible result: 10,520ms duty / 240ms rest gives 0.18 / 0 / 0.17 minutes; 11,120ms / 240ms gives 0.19 / 0 / 0.18; 16,800ms with no rest gives 0.28 / 0 / 0.28. The totals are 0.65 / 0 / 0.63. Those raw example timings are illustrative, not values recovered from the actual database.

The actual runtime workbook retains two ended-session records in its `Break history` worksheet. Their exported timestamps have minute precision, so this review does not claim to recover actual subsecond durations. The workbook's ongoing row is 0.27 minutes while the PDF's is 0.28, producing workbook totals of 0.64 / 0 / 0.62 versus PDF totals of 0.65 / 0 / 0.63. Each sequential download obtains its own clock/`asOf` and read-only repeatable-read snapshot while duty is ongoing; this separate 0.01 difference is consistent with elapsed time between exports. A minute-formatted generation label does not identify an exact shared instant.

Disposition: retain as a P3 owner acceptance observation. Preserve raw duration arithmetic and stored records. A future small presentation clarification may state that row metrics are rounded independently to 0.01 minute, totals sum rounded rows, and subsecond rests can display zero. Do not force net to equal subtraction of already-rounded values, or invent payroll/minimum-break policy. No application edits were made for this observation.

The fresh [all-staff runtime activity rendering](../evidence/phase4/runtime/all-staff-activity.png) was also independently inspected. Its single page visibly renders Arabic and Malayalam names/shop labels and accented Latin text with shaped glyphs; no missing-glyph boxes, clipped text or overlap were observed. This is fresh runtime export evidence, distinct from the retained Phase 3 samples above. Native-language client approval remains pending.
