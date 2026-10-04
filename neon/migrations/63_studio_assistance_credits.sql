-- Explicit migration only. No price/policy activation and no historical balance conversion.
CREATE TABLE IF NOT EXISTS studio_assistance_credit_lots (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES studio_assistance_accounts(user_id),
  kind text NOT NULL CHECK(kind IN ('included','purchased')),
  period date,
  total_credits bigint NOT NULL CHECK(total_credits>0 AND total_credits<=1000000000),
  consumed_credits bigint NOT NULL DEFAULT 0 CHECK(consumed_credits>=0),
  reserved_credits bigint NOT NULL DEFAULT 0 CHECK(reserved_credits>=0),
  amount_cents integer,
  purchase_key uuid,
  tariff_version text,
  receipt_id text,
  purchase_order bigserial NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(user_id,purchase_key),
  CHECK(consumed_credits+reserved_credits<=total_credits),
  CHECK(total_credits%10=0 AND consumed_credits%10=0 AND reserved_credits%10=0),
  CHECK((kind='included' AND period IS NOT NULL AND amount_cents IS NULL AND purchase_key IS NULL AND receipt_id IS NULL)
     OR (kind='purchased' AND period IS NULL AND amount_cents IN (200,500,1000) AND purchase_key IS NOT NULL AND receipt_id IS NOT NULL AND tariff_version IS NOT NULL AND total_credits=amount_cents*10))
);
CREATE UNIQUE INDEX IF NOT EXISTS studio_assistance_credit_month ON studio_assistance_credit_lots(user_id,period) WHERE kind='included';
CREATE INDEX IF NOT EXISTS studio_assistance_credit_account ON studio_assistance_credit_lots(user_id,purchase_order);
CREATE TABLE IF NOT EXISTS studio_assistance_credit_funding (
  call_id uuid PRIMARY KEY REFERENCES studio_assistance_calls(id),
  quoted_cents integer NOT NULL CHECK(quoted_cents>=0),
  charged_cents integer CHECK(charged_cents>=0 AND charged_cents<=quoted_cents),
  reserved_sponsored_nano_usd bigint NOT NULL CHECK(reserved_sponsored_nano_usd>=0),
  charged_sponsored_nano_usd bigint CHECK(charged_sponsored_nano_usd>=0),
  CHECK((charged_cents IS NULL)=(charged_sponsored_nano_usd IS NULL))
);
CREATE TABLE IF NOT EXISTS studio_assistance_credit_allocations (
  call_id uuid NOT NULL REFERENCES studio_assistance_credit_funding(call_id),
  lot_id uuid NOT NULL REFERENCES studio_assistance_credit_lots(id),
  reserved_credits bigint NOT NULL CHECK(reserved_credits>0 AND reserved_credits%10=0),
  charged_credits bigint CHECK(charged_credits>=0 AND charged_credits<=reserved_credits),
  released_at timestamptz,
  PRIMARY KEY(call_id,lot_id),
  CHECK(charged_credits IS NULL OR released_at IS NULL)
);

ALTER TABLE studio_assistance_resolutions ADD COLUMN IF NOT EXISTS refund_credits integer NOT NULL DEFAULT 0 CHECK(refund_credits>=0);

CREATE OR REPLACE FUNCTION enforce_studio_credit_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mutable text[];
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Studio credit evidence is immutable'; END IF;
  mutable:=CASE TG_TABLE_NAME
    WHEN 'studio_assistance_credit_lots' THEN ARRAY['consumed_credits','reserved_credits']
    WHEN 'studio_assistance_credit_funding' THEN ARRAY['charged_cents','charged_sponsored_nano_usd']
    ELSE ARRAY['charged_credits','released_at'] END;
  IF (to_jsonb(NEW)-mutable) IS DISTINCT FROM (to_jsonb(OLD)-mutable)
    OR (TG_TABLE_NAME='studio_assistance_credit_funding' AND to_jsonb(OLD)->>'charged_cents' IS NOT NULL AND NEW IS DISTINCT FROM OLD)
    OR (TG_TABLE_NAME='studio_assistance_credit_allocations' AND (to_jsonb(OLD)->>'charged_credits' IS NOT NULL OR to_jsonb(OLD)->>'released_at' IS NOT NULL) AND NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'Studio credit identity and outcomes are immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS studio_credit_lot_identity ON studio_assistance_credit_lots;
CREATE TRIGGER studio_credit_lot_identity BEFORE UPDATE OR DELETE ON studio_assistance_credit_lots FOR EACH ROW EXECUTE FUNCTION enforce_studio_credit_identity();
DROP TRIGGER IF EXISTS studio_credit_funding_identity ON studio_assistance_credit_funding;
CREATE TRIGGER studio_credit_funding_identity BEFORE UPDATE OR DELETE ON studio_assistance_credit_funding FOR EACH ROW EXECUTE FUNCTION enforce_studio_credit_identity();
DROP TRIGGER IF EXISTS studio_credit_allocation_identity ON studio_assistance_credit_allocations;
CREATE TRIGGER studio_credit_allocation_identity BEFORE UPDATE OR DELETE ON studio_assistance_credit_allocations FOR EACH ROW EXECUTE FUNCTION enforce_studio_credit_identity();

CREATE OR REPLACE FUNCTION enforce_studio_credit_allocation_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM studio_assistance_credit_lots l JOIN studio_assistance_calls c ON c.user_id=l.user_id
    JOIN studio_assistance_credit_funding f ON f.call_id=c.id WHERE l.id=NEW.lot_id AND c.id=NEW.call_id
    AND NEW.reserved_credits+COALESCE((SELECT sum(reserved_credits) FROM studio_assistance_credit_allocations WHERE call_id=NEW.call_id),0)<=f.quoted_cents::bigint*10) THEN
    RAISE EXCEPTION 'Studio credit allocation exceeds its owned reservation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS studio_credit_allocation_scope ON studio_assistance_credit_allocations;
CREATE TRIGGER studio_credit_allocation_scope BEFORE INSERT ON studio_assistance_credit_allocations FOR EACH ROW EXECUTE FUNCTION enforce_studio_credit_allocation_scope();
