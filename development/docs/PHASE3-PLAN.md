# Phase 3 owner review plan

Base: `phase2/integration` at `31402a8`. Work branch: `phase3/owner-review`.

| Work | Owner | Acceptance |
|---|---|---|
| Independent usability review | Design reviewer (read only) | Inspect executive/manager screens, prioritize novice-user obstacles without redesign |
| Evidence and safety review | Evidence reviewer (read only; owns review-detector.json) | Check Phase 2 claims, export behavior and permission boundaries independently |
| Integration, reports and demonstration | Coordinator | Licensed embedded Unicode fonts, selected dates/staff/totals, bounded UI fixes, synthetic demo setup and walkthroughs |
| Verification and handoff | Coordinator, with independent reviewer findings | Fresh automated results; separate-account browser journeys, refresh/fresh login, five widths, real downloads and rendered PDF inspection |

Sequence: preserve baseline evidence → reproduce tests and review → implement minimal fixes → run full acceptance → record exact candidate and owner checklist.

Keep before/after screenshots and machine-readable evidence in `evidence/phase3`. Use disposable synthetic databases for mutating browser tests. Local demonstration records/accounts must be synthetic and credentials stay in ignored `.local` files. Preserve authentication, authorization, transactions, audit and original reference assets.

No production operations, real data, Zoho connection, main merge or push. Human client acceptance remains pending even when automated checks pass.
