BEGIN;
-- No environment is activated by this migration. The local cutover owner records
-- the entire previous staged grid and the certificate in the same transaction.
CREATE TABLE IF NOT EXISTS app_customer_tariff_local_activation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  source_revision BIGINT NOT NULL,
  activated_revision BIGINT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  certificate JSONB NOT NULL,
  previous_staged_cells JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION preserve_customer_tariff_local_activation_event() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'local tariff activation evidence is immutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS app_customer_tariff_local_activation_events_immutable ON app_customer_tariff_local_activation_events;
CREATE TRIGGER app_customer_tariff_local_activation_events_immutable
  BEFORE UPDATE OR DELETE ON app_customer_tariff_local_activation_events
  FOR EACH ROW EXECUTE FUNCTION preserve_customer_tariff_local_activation_event();
COMMIT;
