# Decision log

Owner: user/client unless stated otherwise. Date: 20 October 2026. Passing engineering tests does not accept a business rule.

| ID | Decision | State / reason |
| --- | --- | --- |
| D01 | TypeScript modular application, PostgreSQL relational schema, embedded disk-backed engine for local development | Technical proposal implemented locally; no selected hosted stack/provider is inferred |
| D02 | All signed-in staff read shared shop/visit history; executives create/finish their own visits/follow-ups; managers read team activity; admins manage accounts | **Approved by user in this chat**: “Use these access rules” |
| D03 | One active visit per executive; **multiple executives may visit the same shop**. New follow-up defaults to actual performer; existing follow-ups survive subsequent visits | **Approved in Phase 2 user request**, superseding the earlier one-open-shop proposal. Migration003 removes only the unique open-shop constraint. `VISIT_POLICY=approved-v2` is active in the local synthetic runtime after isolated tests; historical approved-v1 stays gated |
| D04 | One open duty session per executive, repeated rest/return intervals, managers see team duty, executives see their own, visits independent of duty | **Approved by user in this chat**: “Use these duty rules”. `DUTY_POLICY=approved-v1` |
| D05 | Off → on → rest → on → off; return before ending duty; no auto-close at midnight; sequential sessions allowed without duration/pay rules | Implementation interpretation of D04; exact cut-duty meaning, allowed shift/rest limits and missed-event corrections still require client review. Raw instants survive overnight; no hours/payroll reporting is inferred |
| D06 | Asia/Dubai for all business reporting, timestamptz events and DATE due dates | **Approved in Phase 2 user request**; UAE midnight and report boundaries tested |
| D07 | Executive discoveries self-assigned; manager/admin explicitly edit/transfer shops and assign pending follow-ups to active same-organization executives, with reason/audit/version; visiting never transfers ownership | **Approved by user**: “Use manager/admin assignment with audit”. Transfers preserve historical visitors and existing follow-up owners. Executives manage only their own follow-ups. Managers cannot check out/overwrite others' visits. Lead conversion and closed-visit corrections remain unspecified/unavailable |
| D08 | Online-first; optional single GPS fix including availability/accuracy/browser capture time, server event time authoritative | Preserves baseline; continuous tracking/geofence/offline sync are outside scope |
| D09 | Authentication uses real local password accounts, scrypt hashes, opaque HttpOnly sessions and CSRF protection | Local implementation, not a provider choice. Recovery, onboarding, offboarding, rotation, MFA/SSO and hosted identity selection are later operational decisions |
| D10 | No hosted services, production changes, production accounts, real imports, Zoho integration or automatic production/main merge | Explicit Phase 2 release restrictions. Provider, region, domain, staging target, retention and release owner remain unselected |
| D11 | Simple daily executive/manager interfaces, large mobile controls, short forms, prominent manager Excel/PDF downloads | **Mandatory user steering**. Complete report downloads authorized for manager/admin, not general customer export. Actual date/person selections govern downloads; reports do not silently truncate. No charts or complex analytics added |

## Remaining business choices

D03 and explicit manager/admin assignment authority are settled for isolated local development. They no longer block the core journeys. Switching from approved-v2 to pending remains an explicit operator gate; approved-v1 cannot accidentally reactivate the superseded visit rule.

For client UAT, also review overnight duty behavior, end-from-rest handling and missed-event corrections. The current build records exact instants and provides no correction action, peer duty visibility, hours thresholds or payroll inference.

Still unresolved: missed duty/visit correction authority and procedure; shift/rest limits and exact cut-duty meaning; lead conversion policy; import mapping/duplicate rules and specific commit authority; account recovery/offboarding and hosted identity; retention/privacy/backup ownership; final KPI acceptance; Unicode PDF font/languages; hosting/region/domain and Zoho scope. These do not authorize silent edits, payroll inference, production release or real data import.
