-- Explicit additive migration after 54. Support decisions never fabricate supplier usage.
CREATE TABLE IF NOT EXISTS studio_assistance_resolutions (
  call_id uuid NOT NULL REFERENCES studio_assistance_calls(id),
  action text NOT NULL CHECK(action IN ('waive_unknown','settle_recorded')),
  operator_id text NOT NULL CHECK(length(operator_id) BETWEEN 1 AND 128),
  reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),
  expected_fingerprint text NOT NULL CHECK(expected_fingerprint ~ '^[a-f0-9]{64}$'),
  refund_cents integer NOT NULL DEFAULT 0 CHECK(refund_cents >= 0),
  refund_receipt_id text,
  revoked_lease_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(call_id,action),
  CHECK((refund_cents > 0) = (refund_receipt_id IS NOT NULL)),
  CHECK(action='waive_unknown' OR refund_cents=0)
);
CREATE OR REPLACE FUNCTION preserve_studio_assistance_resolution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Studio assistance support decisions are immutable'; END;
$$;
DROP TRIGGER IF EXISTS studio_assistance_resolution_immutable ON studio_assistance_resolutions;
CREATE TRIGGER studio_assistance_resolution_immutable BEFORE UPDATE OR DELETE ON studio_assistance_resolutions
FOR EACH ROW EXECUTE FUNCTION preserve_studio_assistance_resolution();
