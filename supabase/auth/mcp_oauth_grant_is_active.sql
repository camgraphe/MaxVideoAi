-- Auth-only configuration. Review and apply explicitly to Supabase, never Neon.
-- No application tables, grants or sessions are created or modified.
BEGIN;

CREATE OR REPLACE FUNCTION public.mcp_oauth_grant_is_active(
  p_user_id uuid,
  p_client_id uuid,
  p_session_id uuid,
  p_required_scopes text[]
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM auth.sessions AS session
    JOIN auth.oauth_consents AS consent
      ON consent.user_id = session.user_id
      AND consent.client_id = session.oauth_client_id
    JOIN auth.oauth_clients AS client ON client.id = consent.client_id
    WHERE session.id = p_session_id
      AND session.user_id = p_user_id
      AND session.oauth_client_id = p_client_id
      AND (session.not_after IS NULL OR session.not_after > now())
      AND consent.revoked_at IS NULL
      AND client.deleted_at IS NULL
      AND p_required_scopes IS NOT NULL
      AND string_to_array(consent.scopes, ' ') @> p_required_scopes
      AND string_to_array(coalesce(session.scopes, ''), ' ') @> p_required_scopes
  );
$function$;

REVOKE ALL ON FUNCTION public.mcp_oauth_grant_is_active(uuid, uuid, uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_oauth_grant_is_active(uuid, uuid, uuid, text[]) TO service_role;
COMMENT ON FUNCTION public.mcp_oauth_grant_is_active(uuid, uuid, uuid, text[]) IS
  'Service-only boolean OAuth consent/session check; accepts identifiers from server-verified JWT claims, never client tool arguments.';

COMMIT;
