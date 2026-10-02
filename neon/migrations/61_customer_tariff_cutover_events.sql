BEGIN;
-- Initial release/recovery evidence is separate from development-only staging.
-- This migration does not activate customer tariffs or replace any amounts.
CREATE TABLE IF NOT EXISTS app_customer_tariff_cutover_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL CHECK (operation IN ('activate', 'rollback')),
  activation_event_id UUID REFERENCES app_customer_tariff_cutover_events(id),
  actor_id UUID NOT NULL,
  source_revision BIGINT NOT NULL CHECK (source_revision >= 0),
  target_revision BIGINT NOT NULL CHECK (target_revision = source_revision + 1),
  fingerprint TEXT NOT NULL UNIQUE,
  certificate JSONB NOT NULL CHECK (jsonb_typeof(certificate) = 'object'),
  grid_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK ((operation = 'activate' AND activation_event_id IS NULL)
    OR (operation = 'rollback' AND activation_event_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS app_customer_tariff_cutover_once_rollback
  ON app_customer_tariff_cutover_events (activation_event_id) WHERE operation = 'rollback';
CREATE OR REPLACE FUNCTION preserve_customer_tariff_cutover_event() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'customer tariff cutover evidence is immutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS app_customer_tariff_cutover_events_immutable ON app_customer_tariff_cutover_events;
CREATE TRIGGER app_customer_tariff_cutover_events_immutable
  BEFORE UPDATE OR DELETE ON app_customer_tariff_cutover_events
  FOR EACH ROW EXECUTE FUNCTION preserve_customer_tariff_cutover_event();
COMMIT;
