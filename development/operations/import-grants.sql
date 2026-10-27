-- Apply only to a separate, temporary emerald_importer login after migrations.
-- Never grant this role to the web runtime; revoke its login and grants after import.
-- The three column UPDATE grants are required by the importer's FOR UPDATE locks;
-- they also permit direct updates to those columns, so protect this credential and
-- remove the role immediately after the reviewed batch has been reconciled.
GRANT USAGE ON SCHEMA public TO emerald_importer;
GRANT SELECT ON organizations, users, memberships, shops, import_batches,
  import_source_rows, schema_migrations TO emerald_importer;
GRANT UPDATE(name) ON organizations TO emerald_importer;
GRANT UPDATE(active) ON users TO emerald_importer;
GRANT UPDATE(role) ON memberships TO emerald_importer;
GRANT INSERT ON shops, import_batches, import_source_rows, audit_events TO emerald_importer;
GRANT UPDATE(status) ON import_batches TO emerald_importer;
-- No DDL, audit mutation, deletion, truncation or general runtime privileges.
