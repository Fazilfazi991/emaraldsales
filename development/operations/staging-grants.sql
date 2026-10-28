-- Review after the provider creates these two distinct login roles and database.
-- Execute as the database owner, after migrations owned by emerald_migrator.
-- Passwords and role creation are intentionally absent. Never grant role membership
-- from emerald_runtime to emerald_migrator. Set database CONNECT rights at provisioning.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO emerald_runtime;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO emerald_runtime;
GRANT INSERT ON users, memberships, shops, visits, followups, duty_sessions,
  rest_intervals, audit_events, idempotency, sessions, login_attempts TO emerald_runtime;
GRANT UPDATE ON shops, visits, followups, duty_sessions, rest_intervals, login_attempts TO emerald_runtime;
-- PostgreSQL needs an UPDATE privilege for the joined FOR UPDATE authorization lock.
GRANT UPDATE(active,password_hash) ON users TO emerald_runtime;
GRANT UPDATE(role) ON memberships TO emerald_runtime;
GRANT DELETE ON sessions, login_attempts TO emerald_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM emerald_runtime;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON schema_migrations FROM emerald_runtime;
-- No DDL, ownership, TRUNCATE, import privileges, or default grants for future tables.
