BEGIN;
-- Retail edits already serialize on the singleton revision. Use one interval
-- lock as well: a complete atomic seed must not allocate one lock per cell.
CREATE OR REPLACE FUNCTION reject_overlapping_customer_tariff_cells() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('customer-tariff-cell-intervals', 0));
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
COMMIT;
