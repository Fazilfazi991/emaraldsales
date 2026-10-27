-- Data remains inaccessible until a separately approved pilot is configured.
ALTER TABLE shops ALTER COLUMN assigned_executive_id DROP NOT NULL;
ALTER TABLE shops ADD COLUMN emirate text NOT NULL DEFAULT '';
ALTER TABLE shops ADD COLUMN country text NOT NULL DEFAULT '';
ALTER TABLE shops ADD COLUMN whatsapp text NOT NULL DEFAULT '';
ALTER TABLE shops ADD COLUMN zoho_contact_id text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX import_batches_source_per_org ON import_batches(organization_id,source_hash);
ALTER TABLE import_batches ADD COLUMN manifest_hash text;
ALTER TABLE import_batches ADD CONSTRAINT import_batches_org_id UNIQUE (organization_id,id);
CREATE TABLE import_source_rows (
  organization_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('customer','lead')),
  source_row integer NOT NULL CHECK (source_row >= 2),
  shop_id uuid NOT NULL,
  phone_cell_type text NOT NULL CHECK (phone_cell_type IN ('empty','text','number')),
  whatsapp_cell_type text NOT NULL CHECK (whatsapp_cell_type IN ('empty','text','number')),
  PRIMARY KEY (batch_id, source_kind, source_row),
  FOREIGN KEY (organization_id,batch_id) REFERENCES import_batches(organization_id,id),
  FOREIGN KEY (organization_id,shop_id) REFERENCES shops(organization_id,id)
);
