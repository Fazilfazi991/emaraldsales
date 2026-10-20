# Decision log

Owner: user/client unless stated otherwise. Date: 20 October 2026. Passing engineering tests does not accept a business rule.

| ID | Decision | State / reason |
| --- | --- | --- |
| D01 | TypeScript modular application, PostgreSQL relational schema, embedded disk-backed engine for local development | Technical proposal implemented locally; no selected hosted stack/provider is inferred |
| D02 | All signed-in staff read shared shop/visit history; executives create/finish their own visits/follow-ups; managers read team activity; admins manage accounts | **Approved by user in this chat**: “Use these access rules” |
| D03 | One open visit per executive and per shop; new follow-up owned by actual visitor; existing follow-ups retained until explicit action | **Awaiting response** to the open-visit/follow-up question. `VISIT_POLICY=pending` by default. This gate blocks check-in, checkout, follow-up changes and lead save-with-check-in. Read-only history and plain lead save continue. Candidate behavior is implemented/tested only with explicit approved-v1 test configuration |
| D04 | One open duty session per executive, repeated rest/return intervals, managers see team duty, executives see their own, visits independent of duty | **Approved by user in this chat**: “Use these duty rules”. `DUTY_POLICY=approved-v1` |
| D05 | Off → on → rest → on → off; return before ending duty; no auto-close at midnight; sequential sessions allowed without duration/pay rules | Implementation interpretation of D04; exact cut-duty meaning, allowed shift/rest limits and missed-event corrections still require client review. Raw instants survive overnight; no hours/payroll reporting is inferred |
| D06 | Asia/Dubai for all business reporting, timestamptz events and DATE due dates | Proposed technical default implemented and tested; client reporting acceptance pending |
| D07 | Executive discoveries self-assigned; manager/admin cannot create visits or discoveries; no reassignment/lead conversion or closed-visit edits | Conservative first-slice capability restriction. Administrative shop writes/transfer/conversion and correction permissions need explicit specification; their endpoints are unavailable |
| D08 | Online-first; optional single GPS fix including availability/accuracy/browser capture time, server event time authoritative | Preserves baseline; continuous tracking/geofence/offline sync are outside scope |
| D09 | Authentication uses real local password accounts, scrypt hashes, opaque HttpOnly sessions and CSRF protection | Local implementation, not a provider choice. Recovery, onboarding, offboarding, rotation, MFA/SSO and hosted identity selection are later operational decisions |
| D10 | No hosted services, production changes, real imports or Zoho integration | Explicit current boundary. Provider, region, domain, staging target, retention and release owner remain unselected |

## Next business choice

Resolve D03: accept the proposed single-open-visit and visitor-owned follow-up rule, or specify the alternatives. If approved, record the response here, set `VISIT_POLICY=approved-v1` in the local `.env`, restart and rerun browser checks. Do not treat elapsed time or test configuration as approval. No other unresolved decision prevents continuing local read/auth/duty work.

For client UAT, also review overnight duty behavior, end-from-rest handling and missed-event corrections. The current build records exact instants and provides no correction action, peer duty visibility, hours thresholds or payroll inference.

Later choices remain visible without blocking this foundation: visit correction roles/reasons/retention, shop transfer and lead conversion, customer import mappings/duplicates/authority, account recovery/offboarding, export permissions, final KPI definitions, hosting/region/domain/privacy/backup ownership and Zoho scope.
