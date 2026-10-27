# Limited client pilot: implementation and launch status

Owner authorization covers a seven-day protected pilot using the existing Mumbai Supabase project; automatic backups are explicitly not required. No real records, credentials or source workbooks belong in this repository.

The owner identified the Vercel team as Hobby and asked to use it after being informed of the restriction. Vercel's published fair-use rules limit Hobby to personal, non-commercial use; a client business pilot therefore has a provider-terms risk. Do not upgrade or purchase a service without authorization, and do not interpret the earlier demonstration deployment as evidence of pilot readiness.

The Mumbai project was inspected through the owner's browser: PostgreSQL 17.11, zero public tables at inspection, and Data API disabled. The connected Supabase app is authenticated to another organization. The browser's read-only query succeeded. Recurring `pg_pgrst_no_exposed_schemas` errors match Supabase's documented behavior when Data API is disabled; do not enable it to silence these messages. No migrations or real-data imports have been performed.

The local branch includes a gated real-pilot Vercel entrypoint, restricted delivery attendance role, audit-safe account disabling and password reset APIs, Excel import validation, and activity, duty and follow-up Excel/PDF reports. Delivery financial and delivery-recording screens are intentionally unavailable in the real pilot until they have a secure tested backend. No individual staff account has been provisioned yet.

The reports provide a manual export of recorded visits (including discussion and order information), duty/break records and follow-ups. **These exports are not a database backup**: they do not reproduce accounts, sessions, audit history or the complete database. On a free database plan with no automatic backup, device or database failure can permanently lose pilot data. Preserve the two original workbooks and arrange regular private exports of all three reports, stored securely by an identified responsible person.

Remaining release prerequisites include resolving the hosting provider's commercial-use restriction, secure database and separate migration/runtime credentials, a privately provisioned first admin and staff accounts, a reviewed final import manifest, hosted PostgreSQL integration and end-to-end checks, and a usable private onboarding/recovery process. Do not place passwords in public source files, logs or chat. Verify the Vercel deployment contains the Node 22 function and only server-side database credentials; do not expose the browser-local demonstration transport or financial features. Keep automatic deployment disabled and do not replace the demo.

Source: https://vercel.com/docs/limits/fair-use-guidelines and https://supabase.com/kb/troubleshooting/schema-pg_pgrst_no_exposed_schemas-does-not-exist
