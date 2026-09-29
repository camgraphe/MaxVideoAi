BEGIN;

-- The current cell retains its stable ID. Closed versions are append-only evidence.
CREATE TABLE IF NOT EXISTS app_customer_tariff_cell_versions (
  tariff_id TEXT NOT NULL,
  selector_key TEXT NOT NULL,
  selector_json JSONB NOT NULL,
  price_json JSONB NOT NULL,
  currency TEXT NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ NOT NULL,
  revision BIGINT NOT NULL,
  updated_by UUID NOT NULL,
  PRIMARY KEY (tariff_id, revision),
  CHECK (effective_until > effective_from)
);
CREATE INDEX IF NOT EXISTS app_customer_tariff_versions_selector_idx
  ON app_customer_tariff_cell_versions (selector_key, effective_from, effective_until);

CREATE OR REPLACE FUNCTION preserve_customer_tariff_version() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'customer tariff version history is immutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS app_customer_tariff_versions_immutable ON app_customer_tariff_cell_versions;
CREATE TRIGGER app_customer_tariff_versions_immutable BEFORE UPDATE OR DELETE
  ON app_customer_tariff_cell_versions FOR EACH ROW EXECUTE FUNCTION preserve_customer_tariff_version();

COMMIT;
