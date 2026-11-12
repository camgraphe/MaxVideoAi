-- Explicit schema ownership: authoring requests never create tables.
-- The canonical quote continues to own pricing, scope, expiry and the single job claim.
CREATE TABLE IF NOT EXISTS character_builder_quotes (
  quote_id uuid PRIMARY KEY REFERENCES mcp_generation_quotes(quote_id) ON DELETE CASCADE,
  user_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  recipe_hash text NOT NULL CHECK (recipe_hash ~ '^[a-f0-9]{64}$'),
  reference_fingerprint text NOT NULL CHECK (reference_fingerprint ~ '^[a-f0-9]{64}$'),
  recipe jsonb NOT NULL CHECK (recipe->>'surface'='character-builder' AND recipe->>'schemaVersion'='1')
);
CREATE OR REPLACE FUNCTION prevent_character_builder_quote_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Character Builder quote bindings are immutable';
END;
$$;
DROP TRIGGER IF EXISTS character_builder_quote_immutable ON character_builder_quotes;
CREATE TRIGGER character_builder_quote_immutable BEFORE UPDATE ON character_builder_quotes
  FOR EACH ROW EXECUTE FUNCTION prevent_character_builder_quote_mutation();
