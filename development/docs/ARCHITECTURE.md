# Application and API contract

Historical Phase 1 foundation contract at `ec26756`. Phase 2 changes the open-visit rule, enables approved local writes, adds explicit assignment/shop updates and manager report/download APIs. See [the current Phase 2 handoff](PHASE2-HANDOFF.md), [decision log](DECISIONS.md) and [manager report contract](PHASE2-MANAGER-CONTRACT.md). The original Phase 1 details below are retained as an architectural baseline, not a statement of current endpoint availability.

## Local structure and database

One Node HTTP process serves the built client and protected JSON API. TypeScript separates presentation, domain/services and persistence. PGlite provides a disk-backed PostgreSQL engine without Docker or hosted infrastructure. It is the **local adapter**, not the final multi-node hosting choice. A filesystem process lock prevents concurrently opening the same directory. Transactions serialize locally; standard PostgreSQL row locks and partial unique indexes also express the intended constraints. Network PostgreSQL, DB credentials/least-privilege service role, connection pools, cross-process contention and staging migrations are not implemented/tested yet. A later adapter must implement `Database`/`Queryable` and preserve transaction semantics; rerun the entire suite against that provider.

| Table | Purpose and boundaries |
| --- | --- |
| organizations, users, memberships | Stable UUID identities, one organization per user in this foundation, role and active account state |
| sessions, login_attempts | Hashed opaque session token, CSRF secret, server expiry; persisted sign-in throttling |
| shops | Canonical shop/lead status, assigned executive, creator, synthetic/import provenance; no duplicated visit ID or last-date fields |
| visits | Actual visitor and creator, shop link, open/completed lifecycle, accepted online instants, outcome, discussion, descriptive order interest, GPS availability metadata |
| followups | Shop + originating visit, owner + creator, calendar date, pending/completed/cancelled, version for concurrent edits |
| duty_sessions, rest_intervals | Executive-owned, exact instants, at most one open session/rest; separate from visits |
| audit_events | Append-only actor/action/entity/server timestamp/details; trigger prevents row update/delete by application queries |
| idempotency | Actor + request key, route/body hash, committed response in the same transaction; no password/body plaintext stored |
| import_batches | Future import provenance foundation only; import commit endpoint remains unavailable |
| schema_migrations | Applied file name/checksum/time; changed applied migrations fail |

Foreign keys include organization boundaries, and follow-ups' shop must match their originating visit. Partial unique indexes constrain open visits per executive and shop, open duty per executive, and open rest per session. Online events use database `now()`, never submitted arrival/departure times. SQL validates lifecycle consistency and chronological ends. UUIDs are generated server-side. Synthetic data is seeded separately into an empty database.

## Capability matrix

| Capability | Executive | Manager | Admin |
| --- | --- | --- | --- |
| Organization shops/shared visit history, team activity | Read | Read | Read |
| Own check-in/checkout | Policy-gated | Denied | Denied |
| Another person's visit / completed visit edit | Denied | Unavailable pending correction rules | Unavailable pending correction rules |
| Create discovery | Self-assigned | Denied | Denied |
| Follow-up create with checkout / explicit owner actions | Own, policy-gated | Read | Read |
| Duty controls | Own | Denied | Denied |
| Duty history | Own | Team | Team |
| Account list/create API | Denied | Denied | Allowed |
| Assignment, conversion, imports, exports, corrections | Unavailable | Unavailable | Unavailable |

Every operational API route authenticates and scopes reads by organization. The HTTP boundary revalidates sessions against active user/membership state. Mutations lock the current membership and verify its current role before idempotency lookup. UI controls are supplementary, never the authorization boundary. A manager's rejected check-in is never mapped to Ahmed.

## Authentication and transport

Local account provisioning uses random passwords or a private file read by the trusted host CLI. Passwords use salted scrypt; sessions use random 256-bit opaque tokens, SHA-256 hashes at rest, HttpOnly/SameSite=Strict cookies, a 12-hour server expiry, sign-out revocation, and a per-session CSRF token. Login requires exact configured Origin; other writes require both Origin and CSRF. Host validation restricts the configured origin. Login rate limits persist across process restarts (10 account/IP attempts and 100 IP attempts per 15 minutes). Errors don't identify unknown accounts. Secrets are never bundled or committed. Production is deliberately disabled until a hosting/session operations plan exists. Security headers include restrictive CSP and frame denial. All record text is escaped before rendering. Bodies are capped at 32KB, SQL is parameterized, and Zod rejects unknown actor/time/other input fields.

## Transitions and idempotency

Visits: create open → complete once. The check-in actor is the visitor and creator. Checkout verifies ownership and locks the visit; it sets departure, required discussion and outcome atomically, optionally inserts one owned follow-up, appends audit events and commits a retry response. Assignment and canonical shop status stay unchanged. Completed visits return 409 for another checkout; a separately authorized correction flow is future work. Discovery plus immediate check-in is one transaction: an existing open visit causes full discovery rollback.

Follow-ups: pending → completed/cancelled or pending → pending with a new due date. Actions require owner, expected version and reason, preserve the row and append before/after audit. Later visits neither overwrite nor complete existing follow-ups. A checkout date creates a distinct new item. Leads stay in canonical New Lead/Contacted/Interested/Not Interested states until a separately specified conversion action; no hidden conversion occurs on order interest.

Duty: off → on → rest → on → off. No end-from-rest, automatic visit changes or automatic midnight closure. The request includes expected open session ID (null for start). Invalid/repeated transitions or stale session IDs return 409. Rest can repeat. Corrections and cut-duty interpretation are unavailable, with no paid/unpaid or minimum-hour calculations.

All business mutations require an Idempotency-Key of 16–100 safe characters. It is scoped to the authenticated actor and the route plus normalized body. Membership locks serialize a single actor's retries; shop/visit locks and database uniqueness protect competing actors. Same key/body returns the original committed response; changed body with the same key returns 409. Two distinct checkout keys yield one success and one conflict. Audit and response insertion roll back with failed mutations. Keys are retained locally without automatic pruning in this foundation.

## HTTP endpoints

All responses are JSON. Reads return 200; successful mutation/replay returns 200. Lists return `{rows,total,page,pageSize}` with zero-based page and 40 rows. Metadata returns account display names/roles and area choices without credentials.

| Method / path | Input / output |
| --- | --- |
| POST /api/login | `{email,password}` → session cookie + `{csrf}`; only unauthenticated API route |
| GET /api/me | actor, CSRF token, timezone and policy gates |
| POST /api/logout | `{}` → revokes current session |
| GET /api/metadata | team and areas within organization |
| GET /api/shops | `q,page,person,area,status,lead=true,when=due\|visited\|never`; all assignment histories readable |
| GET /api/shops/:id | `{shop,visits,followups}`; complete shop history, latest first |
| GET /api/visits | `q,page,person,area,status,from,to`; inclusive UAE calendar range |
| GET /api/dashboard | derived counters, current-day rows (first 40), all open visits, due follow-ups (first 100), team statistics and recent shops |
| POST /api/checkin | `{shopId,location}` → `{visit}` |
| POST /api/visits/:id/checkout | `{outcome,notes,orderStatus,orderNote,orderValue,followUpDate}` → `{visit,followup}` |
| POST /api/leads | `{name,contact,phone,area,location,notes,assignedExecutiveId,checkIn,gps}` → `{shop,visit}` |
| POST /api/followups/:id | `{action:complete\|cancel,reason,version}` or `{action:reschedule,dueDate,reason,version}` |
| GET /api/duty | optional person UUID; own by default for executives, team for manager/admin; most recent 100 sessions |
| POST /api/duty/start\|rest\|return\|end | `{expectedSessionId}` → `{state,sessionId}` |
| GET /api/accounts | admin-only account list without hashes |
| POST /api/accounts | admin-only `{email,name,role,password}` → UUID; password ≥14 characters, excluded from audit and retry payload |

Location is a discriminated union: `{availability:captured,latitude,longitude,accuracy,capturedAt}` or `{availability:denied|unavailable|timeout|not_requested}`. Browser GPS time is reported metadata, not trusted event time or proof of presence. No continuous tracking, geofence or anti-spoofing claim exists. Plain lead-save uses not_requested; immediate lead check-in does not force a GPS permission request.

Error envelope: `{error:{code,message,fields?},requestId}`. 400 invalid request/key/range; 401 missing/expired session or invalid login; 403 role/owner/CSRF/Origin; 404 missing organization record; 409 lifecycle/concurrency/reused key/policy pending; 413 body too large; 415 JSON required; 422 invalid fields/calendar dates/past follow-up; 429 login throttled; 500 unconfirmed failure. Error logs exclude bodies/cookies/passwords/location coordinates. Failed saves keep the form, and retry reuses its key/payload. No success is displayed before acknowledgement; a lost acknowledgement explicitly says unconfirmed. A reload requires checking shared history, not a localStorage fallback.

## Time and query boundaries

PostgreSQL sessions are UTC; business days use Asia/Dubai explicitly. From/to report dates map to UAE midnight and the exclusive midnight after the end date; current-day counters exclude tomorrow. Due dates remain DATE strings. Histories and duty render UAE local date and time. Cross-midnight duty remains one session with its actual instants. Tests cover 19:59:59Z/20:00:00Z boundaries, leap-date validation, exclusive end, overnight duty/rest, and unchanged follow-ups.

At 700 synthetic shops, lists paginate and relational filters are exercised; no production capacity benchmark is claimed. This first search uses parameterized literal ILIKE plus indexes on organization/name/assignment/history/reporting. Add pg_trgm/search indexes only if measured customer data/query plans warrant them. Dashboard/duty lists are bounded snapshots; clients refresh explicitly. No streaming/synchronization/offline queue is promised.
