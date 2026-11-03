-- Explicit additive migration after 54, 62, 63 and 85. No credit issuance or backfill.
-- Gross charge/provider facts remain immutable. Refunds return the original lots.
CREATE TABLE IF NOT EXISTS studio_assistance_output_refunds (
  call_id uuid PRIMARY KEY REFERENCES studio_assistance_calls(id),
  user_id text NOT NULL,
  session_id uuid NOT NULL,
  request_id uuid NOT NULL,
  response_id text NOT NULL,
  response_fingerprint text NOT NULL CHECK(response_fingerprint ~ '^[a-f0-9]{64}$'),
  expected_fingerprint text NOT NULL CHECK(expected_fingerprint ~ '^[a-f0-9]{64}$'),
  refund_credits integer NOT NULL CHECK(refund_credits>0 AND refund_credits%10=0),
  account_revision bigint NOT NULL CHECK(account_revision>0),
  operator_id text NOT NULL CHECK(length(operator_id) BETWEEN 1 AND 128),
  reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(user_id,session_id,request_id) REFERENCES prompt_assistance_requests(user_id,session_id,request_id)
);
CREATE TABLE IF NOT EXISTS studio_assistance_output_refund_allocations (
  call_id uuid NOT NULL REFERENCES studio_assistance_output_refunds(call_id),
  lot_id uuid NOT NULL,
  refund_credits integer NOT NULL CHECK(refund_credits>0 AND refund_credits%10=0),
  PRIMARY KEY(call_id,lot_id),
  FOREIGN KEY(call_id,lot_id) REFERENCES studio_assistance_credit_allocations(call_id,lot_id)
);
CREATE OR REPLACE FUNCTION enforce_studio_output_refund_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Studio output refund evidence is immutable'; END IF;
  IF TG_TABLE_NAME='studio_assistance_output_refunds' THEN
    IF NOT EXISTS(SELECT 1 FROM studio_assistance_calls c JOIN prompt_assistance_requests r
      ON r.call_id=c.id AND r.user_id=c.user_id AND c.project_id='composer:'||r.session_id::text AND r.request_id=c.request_id
      WHERE c.id=NEW.call_id AND c.user_id=NEW.user_id AND r.session_id=NEW.session_id AND r.request_id=NEW.request_id
        AND c.state='settled' AND r.state='failed' AND r.error='OUTPUT_INVALID' AND (r.reply_json IS NULL OR r.reply_json='null'::jsonb)
        AND c.response_id=NEW.response_id AND r.response_json->>'id'=NEW.response_id AND r.response_json->>'status'='completed'
        AND NOT EXISTS(SELECT 1 FROM studio_assistance_resolutions w WHERE w.call_id=c.id AND w.action='waive_unknown')) THEN
      RAISE EXCEPTION 'Studio output refund must belong to a settled undelivered application-invalid reply';
    END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM studio_assistance_credit_allocations a JOIN studio_assistance_credit_lots l ON l.id=a.lot_id
      JOIN studio_assistance_output_refunds r ON r.call_id=a.call_id AND r.user_id=l.user_id
      WHERE a.call_id=NEW.call_id AND a.lot_id=NEW.lot_id AND a.released_at IS NULL AND a.charged_credits=NEW.refund_credits) THEN
      RAISE EXCEPTION 'Studio output refund must match its original charged allocation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS studio_output_refund_evidence ON studio_assistance_output_refunds;
CREATE TRIGGER studio_output_refund_evidence BEFORE INSERT OR UPDATE OR DELETE ON studio_assistance_output_refunds FOR EACH ROW EXECUTE FUNCTION enforce_studio_output_refund_evidence();
DROP TRIGGER IF EXISTS studio_output_refund_allocation_evidence ON studio_assistance_output_refund_allocations;
CREATE TRIGGER studio_output_refund_allocation_evidence BEFORE INSERT OR UPDATE OR DELETE ON studio_assistance_output_refund_allocations FOR EACH ROW EXECUTE FUNCTION enforce_studio_output_refund_evidence();
