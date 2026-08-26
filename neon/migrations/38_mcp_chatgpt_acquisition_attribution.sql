DO $$
BEGIN
  IF to_regclass('public.mcp_funnel_events') IS NULL
    OR to_regclass('public.mcp_oauth_connection_bindings') IS NULL
  THEN
    RAISE EXCEPTION
      'Migration 38 requires migration 33 before it may be applied';
  END IF;
END
$$;

ALTER TABLE mcp_funnel_events
  DROP CONSTRAINT mcp_funnel_events_attribution_allowlist;

ALTER TABLE mcp_funnel_events
  ADD CONSTRAINT mcp_funnel_events_attribution_allowlist CHECK (
    (
      CASE source
        WHEN 'mcp_landing' THEN
          medium = 'owned'
          AND campaign = 'mcp_connect'
          AND acquisition_client IN ('chatgpt', 'claude', 'codex')
          AND acquisition_id IS NOT NULL
        WHEN 'direct_mcp' THEN
          medium = 'mcp'
          AND campaign = 'none'
          AND acquisition_client = 'other'
          AND acquisition_id IS NULL
        ELSE FALSE
      END
    ) IS TRUE
  );

ALTER TABLE mcp_oauth_connection_bindings
  DROP CONSTRAINT mcp_oauth_connection_bindings_attribution;

ALTER TABLE mcp_oauth_connection_bindings
  ADD CONSTRAINT mcp_oauth_connection_bindings_attribution CHECK (
    source = 'mcp_landing'
    AND medium = 'owned'
    AND campaign = 'mcp_connect'
    AND acquisition_client IN ('chatgpt', 'claude', 'codex')
  );
