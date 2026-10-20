-- Keep future import provenance inside the same organization as the shop.
ALTER TABLE import_batches ADD UNIQUE (organization_id,id);
ALTER TABLE shops DROP CONSTRAINT shops_import_batch_id_fkey;
ALTER TABLE shops ADD CONSTRAINT shops_import_batch_organization_fkey
  FOREIGN KEY (organization_id,import_batch_id) REFERENCES import_batches(organization_id,id);
