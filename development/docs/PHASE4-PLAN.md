# Phase 4 acceptance preparation and readiness

Base verified locally: `phase3/owner-review`, `0b9ad20e554f1a89d9e94918588da44728df9ce1`, clean working tree before starting. Implementation parent `dddeb42fd0e826eb83a9ebf9e618dc429b7e534e` is recorded in Phase 3. Working branch: `phase4/acceptance-readiness`.

| Owner | Exclusive files/work | Acceptance |
|---|---|---|
| Coordinator | Phase 4 plan/report, policy decision sheet, runtime acceptance script/evidence, integration | Separate-role daily journeys including follow-up completion and live duty states; multilingual downloads; no unresolved correction implementation |
| Agent 1 usability | PHASE4-DEMONSTRATION.md, PHASE4-PHONE-UAT.md, evidence/phase4/usability | Five-width independent screen review; short human checklist with actual-device acceptance pending |
| Agent 2 staging | PHASE4-STAGING-PLAN.md only | Inspect actual implementation; practical architecture/security/restore/import/rollback plan; all provisioning remains proposed |
| Agent 3 QA | PHASE4-QA.md, evidence/phase4/qa | Fresh build/test/audit and isolated five-width regression; preserve Phase 3 evidence |

No parallel application feature edits. The coordinator may fix a reproduced defect only after recording it and coordinating regression checks. Otherwise this phase changes documentation and verification assets only.

Completion gate: link actual results, screenshots, account-separated journeys, Unicode report inspection, unresolved policy choices, human UAT checklist and staging prerequisites. Stop for owner review. Local browser tests are not client acceptance or physical-device evidence. No infrastructure, production/main merge, real import, production accounts or Zoho connection.
