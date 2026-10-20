-- Phase 2 permits multiple executives at a shop. Each executive still has at most one open visit.
DROP INDEX one_open_visit_per_shop;
CREATE INDEX visits_open_shop ON visits(organization_id,shop_id) WHERE lifecycle='open';
ALTER TABLE shops ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);
ALTER TABLE shops ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX audit_entity_history ON audit_events(organization_id,entity_type,entity_id,happened_at DESC);
