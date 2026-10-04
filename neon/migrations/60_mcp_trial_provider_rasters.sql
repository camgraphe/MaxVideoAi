-- Correct Mini's 5s 480p supplier estimate to the published 2.0 rasters.
-- New application quotes require 17c square / 18c wide or portrait. The CHECK
-- also admits the historical 10c / 17c snapshots without rewriting any row.
-- Apply before deploying the corrected trial estimator. Safe to replay after 31.
DO $$
BEGIN
  IF to_regclass('public.mcp_trial_quote_prepared_audit') IS NULL THEN
    RAISE EXCEPTION 'Migration 60 requires migration 31 MCP trial prerequisites';
  END IF;
END;
$$;

-- Migration replay must preserve the raster correction installed by migration 60.
-- These are the only two owned definitions; an unfamiliar function fails closed.
DO $trial_cost$
DECLARE
  existing pg_proc%ROWTYPE;
BEGIN
  SELECT * INTO existing FROM pg_proc
   WHERE oid = to_regprocedure('public.mcp_trial_provider_cost_matches_snapshot(text,numeric)');
  IF FOUND AND (
    existing.prosrc NOT IN ('SELECT provider_cost = CASE aspect_ratio WHEN ''1:1'' THEN 10 WHEN ''16:9'' THEN 17 WHEN ''9:16'' THEN 17 ELSE NULL END', 'SELECT provider_cost = CASE aspect_ratio WHEN ''1:1'' THEN 10 WHEN ''16:9'' THEN 17 WHEN ''9:16'' THEN 17 ELSE NULL END OR provider_cost = CASE aspect_ratio WHEN ''1:1'' THEN 17 WHEN ''16:9'' THEN 18 WHEN ''9:16'' THEN 18 ELSE NULL END')
    OR existing.provolatile <> 'i' OR NOT existing.proisstrict
    OR existing.proparallel <> 's' OR existing.prokind <> 'f'
    OR existing.prolang <> (SELECT oid FROM pg_language WHERE lanname = 'sql')
    OR existing.prorettype <> 'boolean'::regtype
  ) THEN
    RAISE EXCEPTION 'Unexpected MCP trial provider-cost function; manual review required';
  END IF;
  
    EXECUTE $definition$CREATE OR REPLACE FUNCTION public.mcp_trial_provider_cost_matches_snapshot(aspect_ratio TEXT, provider_cost NUMERIC)
      RETURNS BOOLEAN LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = pg_catalog
      AS $body$SELECT provider_cost = CASE aspect_ratio WHEN '1:1' THEN 10 WHEN '16:9' THEN 17 WHEN '9:16' THEN 17 ELSE NULL END OR provider_cost = CASE aspect_ratio WHEN '1:1' THEN 17 WHEN '16:9' THEN 18 WHEN '9:16' THEN 18 ELSE NULL END$body$ $definition$;
  
END
$trial_cost$;

ALTER TABLE mcp_generation_quotes
  DROP CONSTRAINT mcp_generation_quotes_funding_allowlist,
  DROP CONSTRAINT mcp_generation_quotes_funding_shape;

ALTER TABLE mcp_generation_quotes
  ADD CONSTRAINT mcp_generation_quotes_funding_allowlist CHECK (
    (funding_mode IN ('wallet', 'trial')) IS TRUE
  ),
  ADD CONSTRAINT mcp_generation_quotes_funding_shape CHECK (
    (
      (
        funding_mode = 'wallet'
        AND price_cents >= 0
        AND NOT (pricing_snapshot ? 'funding')
      )
      OR (
        funding_mode = 'trial'
        AND price_cents = 0
        AND request_json ?& ARRAY[
          'schemaVersion', 'surface', 'engineId', 'mode', 'prompt', 'settings',
          'references', 'outputCount'
        ]::text[]
        AND request_json - ARRAY[
          'schemaVersion', 'surface', 'engineId', 'mode', 'prompt', 'settings',
          'references', 'outputCount'
        ]::text[] = '{}'::jsonb
        AND request_json -> 'schemaVersion' = '1'::jsonb
        AND request_json ->> 'surface' = 'video'
        AND request_json ->> 'engineId' = 'seedance-2-0-mini'
        AND request_json ->> 'mode' = 't2v'
        AND jsonb_typeof(request_json -> 'prompt') = 'string'
        AND jsonb_typeof(request_json -> 'settings') = 'object'
        AND (request_json -> 'settings') ?& ARRAY[
          'durationSec', 'resolution', 'aspectRatio', 'audio'
        ]::text[]
        AND (request_json -> 'settings') - ARRAY[
          'durationSec', 'resolution', 'aspectRatio', 'audio'
        ]::text[] = '{}'::jsonb
        AND request_json #> '{settings,durationSec}' = '5'::jsonb
        AND request_json #>> '{settings,resolution}' = '480p'
        AND request_json #>> '{settings,aspectRatio}' IN ('16:9', '9:16', '1:1')
        AND jsonb_typeof(request_json #> '{settings,audio}') = 'boolean'
        AND request_json -> 'references' = '[]'::jsonb
        AND request_json -> 'outputCount' = '1'::jsonb
        AND pricing_snapshot ?& ARRAY[
          'schemaVersion', 'catalogRevision', 'surface', 'engineId', 'membership',
          'canonicalPricing', 'funding'
        ]::text[]
        AND pricing_snapshot - ARRAY[
          'schemaVersion', 'catalogRevision', 'surface', 'engineId', 'membership',
          'canonicalPricing', 'funding'
        ]::text[] = '{}'::jsonb
        AND pricing_snapshot -> 'schemaVersion' = '1'::jsonb
        AND pricing_snapshot ->> 'catalogRevision' = catalog_revision
        AND pricing_snapshot ->> 'surface' = 'video'
        AND pricing_snapshot ->> 'engineId' = 'seedance-2-0-mini'
        AND NOT mcp_trial_snapshot_has_forbidden_funding_semantics(
          pricing_snapshot - 'funding'
        )
        AND jsonb_typeof(pricing_snapshot -> 'funding') = 'object'
        AND (pricing_snapshot -> 'funding') ?& ARRAY[
          'kind', 'customerChargeCents', 'normalPriceCents', 'providerCostCents'
        ]::text[]
        AND (pricing_snapshot -> 'funding') - ARRAY[
          'kind', 'customerChargeCents', 'normalPriceCents', 'providerCostCents'
        ]::text[] = '{}'::jsonb
        AND pricing_snapshot #>> '{funding,kind}' = 'included_trial'
        AND jsonb_typeof(pricing_snapshot #> '{funding,customerChargeCents}') = 'number'
        AND pricing_snapshot #> '{funding,customerChargeCents}' = '0'::jsonb
        AND jsonb_typeof(pricing_snapshot #> '{funding,normalPriceCents}') = 'number'
        AND (pricing_snapshot #>> '{funding,normalPriceCents}') ~ '^[1-9][0-9]*$'
        AND (pricing_snapshot #>> '{funding,normalPriceCents}')::numeric <= 9007199254740991
        AND jsonb_typeof(pricing_snapshot #> '{funding,providerCostCents}') = 'number'
        AND (pricing_snapshot #>> '{funding,providerCostCents}') ~ '^[1-9][0-9]*$'
        AND (pricing_snapshot #>> '{funding,providerCostCents}')::numeric <= 100
        AND public.mcp_trial_provider_cost_matches_snapshot(
          request_json #>> '{settings,aspectRatio}',
          (pricing_snapshot #>> '{funding,providerCostCents}')::numeric
        )
        AND pricing_snapshot #> '{canonicalPricing,totalCents}'
          = pricing_snapshot #> '{funding,normalPriceCents}'
        AND pricing_snapshot #>> '{canonicalPricing,currency}' = currency
        AND (pricing_snapshot #>> '{funding,providerCostCents}')::numeric
          <= (pricing_snapshot #>> '{funding,normalPriceCents}')::numeric
      )
    ) IS TRUE
  );
