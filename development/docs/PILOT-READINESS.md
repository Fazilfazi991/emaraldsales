# Real-data pilot preparation: not approved for deployment

The public static demonstration stores data in each browser and uses demo role switching. It must not be used for real staff or customer records. The existing hosted backend is restricted to a synthetic workspace and remains so. No real-data hosting, account creation, seeding, import, deployment, or Zoho connection is authorized by this document.

## Current engineering state

This branch adds a manager/admin-only, version-checked enquiry conversion API. It changes the existing record in place, preserving its visits, follow-ups, and owner; conversion and its non-contact audit event are committed together, and retries use the existing idempotency mechanism. The customer and lead list API can filter by `kind`. The existing user interface has not yet been wired to these additions.

Migration 004 and `pilot-import.ts` are **preparatory code**, not a runnable real-data importer: no HTTP route or command invokes it. The transaction rejects duplicate source rows, unapproved/inactive owners, replay with a changed manifest, and initial import into a non-empty workspace. It permits an explicitly unassigned owner and retains the source row and phone cell type. Same-hash retries return the original batch. Tests use fictional records only. The caller must eventually securely read the Excel files, validate their actual hashes and counts, preserve cell representations, explicitly approve the roster and source-to-owner mapping, and construct a manifest. An unassigned owner must never mean an unrecognized owner was silently mapped. There is no current approved real-data pilot configuration; the synthetic hosted guard has not been bypassed.

Migration 004 must be reviewed for the existing hosted runtime grants, migration readiness checks and backward compatibility before deployment. In particular, all uses of nullable assignments and new columns need end-to-end review. Do not apply this migration to a hosted database without approval.

## Blockers before a real pilot

- Complete and independently review the private Excel-to-manifest and preview workflow, including field lengths, numeric phone formatting, provenance, duplicates, mapping exceptions and authorization. Do not automatically merge source rows. Re-verify exact source file hashes and counts at approval time.
- Get the actual staff roster and explicit mapping for every source salesperson label, including the relationship between SAEED PK and SAEED. Define how unresolved and missing salespeople will be handled.
- Implement and review a separately gated real-data hosted configuration, real account onboarding/recovery, and private workspace provisioning. Keep synthetic staging isolated, including its 700 fictional shops.
- Wire the secure frontend for separate customer and enquiry views, lead status changes and manager conversion, manager lead counts, assignments and working-hours reports; regression-test all access rules. The delivery/collection workflow must remain disabled for real users until it has a secure tested backend.
- Address the existing shop-edit audit behavior: it stores before/after shop values, including phone numbers. Redesign and review the audit policy to retain accountability without recording phone values in audit logs. Also review application/error logging and other sensitive-data paths. This is a release blocker.
- Verify backup encryption, isolation and a full restore in an approved environment, followed by multi-account browser acceptance and the requested device widths. A local synthetic test is not proof of hosted restore or physical-phone testing.

## Infrastructure proposal for owner review

Use a private, isolated managed PostgreSQL database, TLS with certificate verification, and the existing server-side authenticated application hosted in a separate protected environment. Select the provider and available region jointly with the owner, agree a monthly budget cap and named administrators, restrict access to approved testers, and specify who monitors backups and performs restore drills. No provider, region, cost, access list, or backup owner has been approved yet. The exact deployment architecture and account recovery procedure require a security review; do not use the static demo for this purpose.

Before hosted import, the owner must approve the chosen infrastructure, staff roster, exact reviewed batch and its file hashes, handling of exceptions, backup/restore and retention/export procedures. Preserve original spreadsheets privately. Do not expose tax registration data in ordinary field-sales views or logs. Do not place real records, files, contact numbers, tax identifiers or private logs in the public repository.
