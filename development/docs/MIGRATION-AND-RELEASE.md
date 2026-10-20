# Migration, import and release plan

## Local migrations and fixtures

The current user authorizes local development, not hosted resources, production schema changes, real imports or a rollout. `pnpm db:migrate` applies versioned SQL in one transaction per file and records its checksum. It is repeatable and refuses edited applied files. There is no destructive automatic down migration. Initial migration creates the full relational foundation without adding accounts/customer data. Synthetic seed is a separate explicit `pnpm db:seed --synthetic 700`; it refuses a nonempty user database. The 36 reference shops/history are normalized and extended to 700 clearly marked fictional records; current seed timestamps are clamped so fixture history never lies in the future. Ambiguous old “Interested” visit outcome is normalized to New Opportunity. Fixture follow-up ownership uses the originating visitor, not the shop assignee. All of this is synthetic provenance, not a customer-data reconciliation.

The original reference files and archives remain unchanged. Schema/source are under Git; `.data`, `.local`, `.env`, generated bundles and dependencies are excluded. Random synthetic credentials are held in `.local/accounts.json` only. To reset a review workspace, select a **new** empty DATA_DIR and seed there; do not delete an existing customer database or silently reset records.

## Reviewable backup and rollback

For this embedded local adapter, stop the app and all DB commands, then copy the complete data directory. Do not copy a live PostgreSQL directory. The automated suite closes the database, copies it, reopens a separate restored directory, reapplies checksum verification and checks that the completed visit remains. This is bounded local restore evidence; no hosted recovery/PITR certification is implied.

Example from the development directory, with the server stopped, using a fresh backup destination:

```powershell
New-Item -ItemType Directory -Path .local\backups -Force
Copy-Item -LiteralPath .data\crm -Destination .local\backups\crm-before-review -Recurse -ErrorAction Stop
```

Before running that command, verify `.local/backups/crm-before-review` does not already exist. For rollback/restore, keep both the source and backup and select the copied directory without overwriting either:

```powershell
$env:DATA_DIR = '.local/backups/crm-before-review'
.\scripts\run.ps1 db:migrate
.\scripts\run.ps1 dev
```

Unset that process variable when returning to the primary local directory. Treat backups as sensitive and preserve corresponding local review credentials separately. A fresh staging environment later needs a real backup/restore mechanism, recovery targets, secret/session rotation and an operator. Schema rollback after real writes should use an explicit forward repair or restore with reconciliation, never indiscriminate table drops. Reverting a Git commit alone does not roll back data.

## Future customer import: deliberately unavailable

1. Obtain a specifically authorized customer source, intended organization/environment and import owner. Retain an immutable source checksum, filename, timestamp and permitted retention.
2. Stage rows separately. Show a preview and field mapping for name, contact, phone, area, location, status and executive mapping. Do not infer real users from fictional names. Preserve source row identifiers.
3. Validate required fields, lengths, safe text, UAE/international number normalization, allowed canonical statuses and active assignee identities. Record row-level errors; do not discard quietly.
4. Review duplicates using exact external IDs/normalized phones and cautious name+area candidates. Names alone cannot trigger automatic merges. Require explicit merge/skip/create decisions and preserve histories.
5. Run a dry-run with accepted, rejected, duplicate, skipped and updated counts. Reconcile total input rows and the expected after-import counts. Keep synthetic fixtures outside the target customer organization/database.
6. Present the exact target, mapping, duplicate decisions, report, backup/rollback plan and checksum for authorized commit. A replay-safe transaction must reference the reviewed batch checksum and actor, create import provenance and audit rows, and report accepted/rejected row IDs.
7. Reconcile authoritative counts and spot-check assignments/shared histories in separate authenticated executive and manager sessions. Preserve source/import reports securely. No customer data has been supplied or imported here.

`import_batches` and shop provenance columns are scaffolding. There is no import UI, parser, dry-run implementation or commit path yet; the endpoint returns POLICY_PENDING. Exports likewise remain unavailable until permissions and format are agreed.

## Path to staging and production

Select provider, region, domain, organization/account lifecycle and release owner explicitly. Replace the local adapter with tested network PostgreSQL persistence, use a scoped application DB role and separate migration role, configure external secret management, TLS/secure cookies, backups, recovery, monitoring and session operations. Rehearse migrations against a sanitized/synthetic staging database with rollback/restore evidence, including independent DB connections and multiple server processes. Pin dependency/tool versions and review updates/security as part of release work. Do not assume Supabase, Vercel or any other portfolio provider.

Before a release approval request, complete a concrete candidate: accepted business policies; account provisioning/offboarding/recovery; permitted visit correction/assignment rules; authorized customer import tooling/reconciliation; representative mobile devices and GPS denial/success; measured concurrency on selected database; security/operational review; monitoring and backup restore; documented migrations, rollback and release-specific smoke checks. Have executives and manager perform separate client UAT. Then seek authorization for the specific target/deployment/import. This build has no deployment target and is not a production release candidate.
