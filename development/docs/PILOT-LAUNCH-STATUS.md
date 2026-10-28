# Emerald staff pilot — verified 28 October 2026

The dedicated online application is https://emerald-sales-pilot-faziils-projects.vercel.app/. It uses the Mumbai Supabase project `yyfkpcvasxgoavhvlcsu`, PostgreSQL 17, with the Data API disabled. The public fictional demonstration remains separate.

## Database and import

Six versioned migrations were applied and their checksums verified. The web application connects through the TLS-verified transaction pooler using `emerald_runtime`. This role cannot create schema objects or modify migration history or audit events. Migration credentials are separate and are not configured in the hosted application. Public schema access is explicitly restricted.

The approved client workbooks were imported as 524 Customers and 424 Enquiries. All eight unidentified enquiry owners remain unassigned for manager review. The authorized unusable contact-person formula cell is blank. Source row references, original numeric phone representations and formatting metadata, import hashes, and review codes are retained. Similar names were not merged and no source row was dropped. The original workbooks remain private and unchanged; the CRM does not represent every workbook column.

The final counts were reconciled with the database. A same-batch retry returned the existing import without duplication. No fictional shops exist in the real workspace. The temporary import operator was removed after reconciliation. The existing `emerald_pilot_test` database contains only fictional acceptance data and is not the application's live database.

## Staff access and verification

Five approved individual accounts were provisioned: one manager, three sales executives, and one delivery staff member. Sign-in identifiers and generated passwords are delivered privately, outside Git. They are not verified mailboxes and no automated email invitation is implied.

All five hosted logins passed. A salesman saved a clearly labelled owner-authorized setup-test visit, and the manager read it from another authenticated session. Its setup follow-up was completed so it does not create an operational pending item. The labelled test visit remains in history; it represents no physical visit, customer contact, sale, or collection.

Fresh-login persistence, assigned enquiry restrictions, anonymous API and export rejection, staff role restrictions, account disabling, manager-assisted password reset and session revocation passed on the hosted application. Six actual manager downloads (activity, duty and follow-ups in Excel and PDF) passed. Manager and executive browser checks passed at 390, 430, 768, 1024 and 1440 pixels. Duty start, break, return and end were checked against the isolated hosted PostgreSQL test database. The regular automated suite passed 116 tests.

The production address exposes only the login page and non-sensitive assets without a CRM session. Business APIs require server-side authentication; writes also require an exact origin, CSRF token, authorization and transaction-safe request handling. Hosting authentication remains enabled for deployment and Preview URLs. Automatic Git deployment remains disabled. Node 22, the Node framework preset, project root `development`, root function `server.ts`, Mumbai function region, and the exact application HTTPS origin are configured.

## Available features and limits

Customers and search; separate assigned Enquiries; visits and discussion notes; optional confirmed order amount; independent follow-ups; duty, breaks and working hours; manager activity, attendance and reports; and delivery staff attendance are available. Confirmed order values remain separate from collections. Formal invoices and accounting remain outside this CRM.

Financial collection and delivery-recording entry are disabled because their secure operational backend is not complete. Recovery is manager-assisted: there is no self-service reset email, expiring invitation or staff password-change screen. Only administrators can manage privileged manager/admin accounts; the designated manager can manage sales and delivery accounts. Initial owner recovery remains a private operator procedure.

Role changes are blocked while active work or executive assignments would be stranded. Enquiry transfers are blocked while an open visit or pending follow-up exists. These conservative rules preserve existing records and should be reviewed with the manager before changing policy.

## Private operations and rollback

Keep accounts, source workbooks, import manifests, screenshots, exports, logs and credentials out of the public repository. Staff login handoff is retained under Windows user encryption in the owner's ignored local private directory. The temporary database credential handoff is removed after deployment verification. Never use the owner or migration URL as the application's `DATABASE_URL`.

Owner-approved manual report exports are available as a lightweight safeguard. They are **not a complete database backup** and do not restore accounts, sessions, audit history or all database records. No paid automated backup was provisioned; database loss can permanently lose newly recorded pilot activity. Retain original workbooks and store regular private activity, duty and follow-up exports securely.

If access must be stopped, pause only the dedicated `emerald-sales-pilot` hosting project or disable the relevant staff account. Preserve the database and its import records. Revert application source only to a verified compatible revision; do not roll back by deleting tables or customer records. Re-enabling requires the same authentication, role and persistence checks.
