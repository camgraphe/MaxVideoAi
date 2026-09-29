BEGIN;

ALTER TABLE app_pricing_change_events DROP CONSTRAINT IF EXISTS app_pricing_change_events_domain_check;
ALTER TABLE app_pricing_change_events
  ADD CONSTRAINT app_pricing_change_events_domain_check
  CHECK (domain IN ('policy_rule', 'membership', 'billing_product', 'customer_tariff'));

CREATE TABLE IF NOT EXISTS app_customer_tariff_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
  active BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO app_customer_tariff_state (singleton, revision, active)
VALUES (TRUE, 0, FALSE) ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_customer_tariff_cells (
  id TEXT PRIMARY KEY,
  selector_key TEXT NOT NULL,
  selector_json JSONB NOT NULL CHECK (jsonb_typeof(selector_json) = 'object'),
  price_json JSONB NOT NULL CHECK (jsonb_typeof(price_json) = 'object'),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ,
  revision BIGINT NOT NULL CHECK (revision > 0),
  updated_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_customer_tariff_cells_nonempty_interval CHECK (effective_until IS NULL OR effective_until > effective_from)
);
CREATE INDEX IF NOT EXISTS app_customer_tariff_cells_selector_idx
  ON app_customer_tariff_cells (selector_key, effective_from, effective_until);

CREATE OR REPLACE FUNCTION reject_overlapping_customer_tariff_cells() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.selector_key, 0));
  IF EXISTS (
    SELECT 1 FROM app_customer_tariff_cells existing
    WHERE existing.selector_key = NEW.selector_key AND existing.id <> NEW.id
      AND tstzrange(existing.effective_from, existing.effective_until, '[)')
          && tstzrange(NEW.effective_from, NEW.effective_until, '[)')
  ) THEN
    RAISE EXCEPTION 'overlapping customer tariff intervals for selector %', NEW.selector_key;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS app_customer_tariff_cells_no_overlap ON app_customer_tariff_cells;
CREATE TRIGGER app_customer_tariff_cells_no_overlap
  BEFORE INSERT OR UPDATE OF selector_key, effective_from, effective_until
  ON app_customer_tariff_cells FOR EACH ROW
  EXECUTE FUNCTION reject_overlapping_customer_tariff_cells();

COMMIT;
