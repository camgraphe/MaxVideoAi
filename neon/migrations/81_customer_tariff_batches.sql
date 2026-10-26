BEGIN;

-- Deployment operators must explicitly bind a reviewed source and database target.
-- This migration never changes a customer price or enables the feature.
CREATE TABLE app_tariff_batch_control (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  source_id TEXT CHECK (source_id ~ '^[0-9a-f]{40}$'),
  target_id UUID NOT NULL DEFAULT gen_random_uuid(),
  CHECK (NOT enabled OR source_id IS NOT NULL)
);
INSERT INTO app_tariff_batch_control (singleton) VALUES (TRUE);

CREATE TABLE app_tariff_batch_operations (
  id UUID PRIMARY KEY,
  actor_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('previewed', 'accepted', 'committed', 'not_applied')),
  epoch INTEGER NOT NULL DEFAULT 0 CHECK (epoch >= 0),
  fingerprint TEXT NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  source_id TEXT NOT NULL,
  target_id UUID NOT NULL,
  proposal_json JSONB NOT NULL,
  plan_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at),
  failure TEXT
);
CREATE INDEX app_tariff_batch_operations_actor_created ON app_tariff_batch_operations (actor_id, created_at DESC, id DESC);

CREATE TABLE app_tariff_batch_receipts (
  operation_id UUID PRIMARY KEY REFERENCES app_tariff_batch_operations(id),
  receipt_json JSONB NOT NULL CHECK (jsonb_typeof(receipt_json) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION preserve_tariff_batch_receipt() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'tariff batch receipt is immutable'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER app_tariff_batch_receipts_immutable BEFORE UPDATE OR DELETE ON app_tariff_batch_receipts
  FOR EACH ROW EXECUTE FUNCTION preserve_tariff_batch_receipt();

CREATE FUNCTION preserve_tariff_batch_operation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'tariff batch operation is immutable'; END IF;
  IF (to_jsonb(NEW) - ARRAY['status','epoch','failure']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status','epoch','failure']) THEN
    RAISE EXCEPTION 'tariff batch preview is immutable';
  END IF;
  IF NOT ((OLD.status = 'previewed' AND NEW.status = 'accepted' AND NEW.epoch = OLD.epoch + 1)
       OR (OLD.status = 'accepted' AND NEW.status = 'committed' AND NEW.epoch = OLD.epoch)
       OR (OLD.status = 'accepted' AND NEW.status = 'not_applied' AND NEW.epoch = OLD.epoch + 1)) THEN
    RAISE EXCEPTION 'invalid tariff batch state transition';
  END IF;
  IF NEW.status = 'committed' AND NOT EXISTS (SELECT 1 FROM app_tariff_batch_receipts WHERE operation_id = NEW.id) THEN
    RAISE EXCEPTION 'committed tariff batch requires receipt';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER app_tariff_batch_operations_guard BEFORE UPDATE OR DELETE ON app_tariff_batch_operations
  FOR EACH ROW EXECUTE FUNCTION preserve_tariff_batch_operation();
COMMIT;
