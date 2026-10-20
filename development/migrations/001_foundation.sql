CREATE TABLE organizations (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE users (
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE CHECK (email = lower(email)), name text NOT NULL,
  password_hash text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
  organization_id uuid NOT NULL REFERENCES organizations, user_id uuid NOT NULL REFERENCES users,
  role text NOT NULL CHECK (role IN ('executive','manager','admin')), PRIMARY KEY (organization_id,user_id),
  UNIQUE (user_id)
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users, csrf_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE login_attempts (key_hash text PRIMARY KEY, attempts integer NOT NULL, reset_at timestamptz NOT NULL);
CREATE TABLE shops (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160), contact text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '', area text NOT NULL, location text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('Customer','New Lead','Contacted','Interested','Not Interested')),
  assigned_executive_id uuid NOT NULL, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  synthetic boolean NOT NULL DEFAULT false, import_batch_id uuid,
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,assigned_executive_id) REFERENCES memberships(organization_id,user_id),
  FOREIGN KEY (organization_id,created_by) REFERENCES memberships(organization_id,user_id)
);
CREATE INDEX shops_org_name ON shops(organization_id,lower(name));
CREATE INDEX shops_assignment ON shops(organization_id,assigned_executive_id);
CREATE TABLE visits (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL, shop_id uuid NOT NULL,
  visitor_id uuid NOT NULL, created_by uuid NOT NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(), checked_out_at timestamptz,
  lifecycle text NOT NULL DEFAULT 'open' CHECK (lifecycle IN ('open','completed')),
  outcome text CHECK (outcome IN ('Regular Visit','Follow-up Required','Order Expected','Order Received','Not Interested','Customer Not Available','Closed','New Opportunity')),
  notes text NOT NULL DEFAULT '', order_status text NOT NULL DEFAULT 'No Order' CHECK (order_status IN ('No Order','Order Expected','Order Received')),
  order_note text NOT NULL DEFAULT '', order_value numeric(12,2) CHECK (order_value >= 0),
  location jsonb NOT NULL, version integer NOT NULL DEFAULT 1,
  UNIQUE (organization_id,id), UNIQUE (organization_id,id,shop_id),
  FOREIGN KEY (organization_id,shop_id) REFERENCES shops(organization_id,id),
  FOREIGN KEY (organization_id,visitor_id) REFERENCES memberships(organization_id,user_id),
  FOREIGN KEY (organization_id,created_by) REFERENCES memberships(organization_id,user_id),
  CHECK ((lifecycle='open' AND checked_out_at IS NULL AND outcome IS NULL) OR
    (lifecycle='completed' AND checked_out_at >= checked_in_at AND outcome IS NOT NULL AND length(trim(notes)) > 0))
);
CREATE UNIQUE INDEX one_open_visit_per_executive ON visits(organization_id,visitor_id) WHERE lifecycle='open';
CREATE UNIQUE INDEX one_open_visit_per_shop ON visits(organization_id,shop_id) WHERE lifecycle='open';
CREATE INDEX visits_history ON visits(organization_id,shop_id,checked_in_at DESC);
CREATE INDEX visits_reporting ON visits(organization_id,checked_in_at DESC);
CREATE TABLE followups (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL, shop_id uuid NOT NULL, visit_id uuid NOT NULL,
  owner_id uuid NOT NULL, created_by uuid NOT NULL, due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
  FOREIGN KEY (organization_id,visit_id,shop_id) REFERENCES visits(organization_id,id,shop_id),
  FOREIGN KEY (organization_id,owner_id) REFERENCES memberships(organization_id,user_id),
  FOREIGN KEY (organization_id,created_by) REFERENCES memberships(organization_id,user_id)
);
CREATE INDEX followups_due ON followups(organization_id,status,due_date);
CREATE TABLE duty_sessions (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL, executive_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,executive_id) REFERENCES memberships(organization_id,user_id),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX one_open_duty ON duty_sessions(organization_id,executive_id) WHERE ended_at IS NULL;
CREATE TABLE rest_intervals (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL, session_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
  FOREIGN KEY (organization_id,session_id) REFERENCES duty_sessions(organization_id,id),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX one_open_rest ON rest_intervals(session_id) WHERE ended_at IS NULL;
CREATE TABLE audit_events (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL, actor_id uuid NOT NULL, action text NOT NULL,
  entity_type text NOT NULL, entity_id uuid NOT NULL, happened_at timestamptz NOT NULL DEFAULT now(), details jsonb NOT NULL,
  FOREIGN KEY (organization_id,actor_id) REFERENCES memberships(organization_id,user_id)
);
CREATE FUNCTION immutable_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit events are append-only'; END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION immutable_audit();
CREATE TABLE idempotency (
  actor_id uuid NOT NULL REFERENCES users, key text NOT NULL, request_hash text NOT NULL,
  response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,key)
);
CREATE TABLE import_batches (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations, source_name text NOT NULL,
  source_hash text NOT NULL, status text NOT NULL CHECK (status IN ('staged','reviewed','committed','rejected')),
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,created_by) REFERENCES memberships(organization_id,user_id)
);
ALTER TABLE shops ADD FOREIGN KEY (import_batch_id) REFERENCES import_batches(id);
