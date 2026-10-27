ALTER TABLE import_source_rows ADD COLUMN phone_format text NOT NULL DEFAULT '';
ALTER TABLE import_source_rows ADD COLUMN whatsapp_format text NOT NULL DEFAULT '';
ALTER TABLE import_source_rows ADD COLUMN review_codes jsonb NOT NULL DEFAULT '[]'::jsonb;
