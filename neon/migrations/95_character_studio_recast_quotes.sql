-- Recast can only confirm a quote it created in the same transaction.
CREATE TABLE IF NOT EXISTS character_studio_recast_quotes (
  quote_id uuid PRIMARY KEY REFERENCES mcp_generation_quotes(quote_id) ON DELETE CASCADE,
  user_id text NOT NULL,
  request_hash text NOT NULL,
  passages jsonb NOT NULL
);
