# Admin and Sales Manager

The existing `manager` role is displayed as **Sales Manager**. Its account identity,
password, sales assignments and historical activity remain unchanged. `admin` is
the existing company administration role; no new role or schema is introduced.

Admin opens to a daily company overview. Totals use saved records and Asia/Dubai
dates. Working time is today's recorded duty less recorded breaks; confirmed
sales values are completed visits started that day, separate from collections.
The overview returns one employee page (25 rows), not employee histories.
Employee search and administrative history also return 25-row pages.
Click a field employee's name to open their filtered activity or duty report.
Company reports reuse the existing authenticated Excel and PDF exports.

Only Admin may list accounts, create accounts, change roles, activate/disable
accounts or reset passwords. These restrictions apply to the original `/api/accounts`
routes and the `/api/admin/*` routes, independently of navigation visibility.
Sales Manager retains sales operations, assignments, attendance and reporting.
Executives and delivery staff keep their existing approved permissions.
Financial collection recording remains disabled.

Account mutations lock workspace memberships in a consistent order before the
actor and target checks. Disabling oneself or changing one's own role is rejected.
Removing the last active Admin is rejected. Concurrent changes recheck active
membership within the transaction. Role changes and disabling revoke only the
target's sessions. Password resets revoke the target's sessions and store only
salted password hashes. Audit events are append-only, and password material is
excluded from audit and idempotency payloads.

Account recovery is Admin-assisted, not self-service email recovery. A separate
Admin must be privately provisioned by an authorized operator if none exists;
never promote a Sales Manager automatically. Keep operator credentials and staff
handoffs outside source control. If the only Admin loses access, an authorized
database operator must privately recover access; there is no public bootstrap API.

Verification covers role denial on every administrative API, employee lifecycle,
targeted session revocation, self-protection, concurrent Admin changes under
restricted PostgreSQL grants, pagination, saved totals and responsive screens.
Live acceptance also checks unchanged staff identities and sessions across release,
customer/enquiry counts and report downloads. Private evidence and screenshots
are retained locally and must not be uploaded to the public repository.
