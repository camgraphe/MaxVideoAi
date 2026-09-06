export type McpOutcomeRelations = {
  audit: boolean;
  quotes: boolean;
  jobs: boolean;
  profiles: boolean;
  funnel: boolean;
  clientFamily: boolean;
};

export const MCP_OUTCOME_RELATIONS_SQL = `/* admin-mcp:outcome-relations */
  SELECT
    to_regclass('public.mcp_audit_events') IS NOT NULL AS audit,
    to_regclass('public.mcp_generation_quotes') IS NOT NULL AS quotes,
    to_regclass('public.app_jobs') IS NOT NULL AS jobs,
    to_regclass('public.profiles') IS NOT NULL AS profiles,
    to_regclass('public.mcp_funnel_events') IS NOT NULL AS funnel,
    EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'mcp_audit_events'
        AND column_name = 'client_family') AS "clientFamily"`;

// Only fixed SQL fragments depend on schema readiness. All reporting dates are parameters.
export function buildMcpOutcomesSql(relations: McpOutcomeRelations): string {
  const reportedClients = relations.clientFamily
    ? `SELECT user_id, oauth_client_id, client_family AS client, created_at AS observed_at, 0 AS priority
         FROM mcp_audit_events WHERE event_type = 'connection_initialized'
          AND outcome = 'success' AND client_family IN ('chatgpt', 'claude', 'codex')`
    : `SELECT NULL::text AS user_id, NULL::text AS oauth_client_id, NULL::text AS client,
         NULL::timestamptz AS observed_at, 0 AS priority WHERE FALSE`;
  const landingClients = relations.funnel
    ? `UNION ALL SELECT user_id, oauth_client_id, acquisition_client, occurred_at, 1
         FROM mcp_funnel_events WHERE event_type = 'oauth_connection_completed'
          AND acquisition_client IN ('chatgpt', 'claude', 'codex')`
    : '';
  return `/* admin-mcp:outcomes */
    WITH auth_profiles AS (
      SELECT * FROM jsonb_to_recordset($3::jsonb -> 'profiles') AS p(user_id text, registered_at timestamptz)
    ), auth_clients AS (
      SELECT * FROM jsonb_to_recordset($3::jsonb -> 'clients') AS c(oauth_client_id text, family text)
    ), client_evidence AS (${reportedClients} ${landingClients}),
    account_activity AS (
      SELECT created_at AS observed_at, user_id, oauth_client_id
        FROM mcp_audit_events
       WHERE created_at < $2 AND (
         (event_type IN ('connection_initialized', 'tool_discovery') AND outcome = 'success')
         OR event_type = 'tool_call')
      UNION ALL
      SELECT created_at, user_id, oauth_client_id FROM mcp_generation_quotes WHERE created_at < $2
    ), latest_accounts AS (
      SELECT MAX(observed_at) AS observed_at, user_id, oauth_client_id
        FROM account_activity GROUP BY user_id, oauth_client_id
    ), facts AS (
      SELECT account.observed_at, account.user_id, account.oauth_client_id,
             'account'::text AS kind, NULL::text AS job_id, NULL::text AS status
        FROM latest_accounts account
      UNION ALL
      SELECT job.created_at, job.user_id, quote.oauth_client_id, 'video', job.job_id, job.status
        FROM mcp_generation_quotes quote
        JOIN app_jobs job ON job.job_id = quote.job_id AND job.user_id = quote.user_id
       WHERE job.created_at >= $1 AND job.created_at < $2 AND job.surface = 'video'
    ), attributed AS (
      SELECT facts.*, COALESCE(identity.client, auth_client.family, 'other') AS client,
             COALESCE(${relations.profiles ? 'CASE WHEN profile.synced_from_supabase THEN profile.created_at END' : 'NULL::timestamptz'}, auth_profile.registered_at) AS registered_at,
             (${relations.profiles ? 'COALESCE(profile.synced_from_supabase, FALSE)' : 'FALSE'} OR auth_profile.registered_at IS NOT NULL) AS profile_known
        FROM facts
        LEFT JOIN auth_profiles auth_profile ON auth_profile.user_id = facts.user_id
        LEFT JOIN auth_clients auth_client ON auth_client.oauth_client_id = facts.oauth_client_id
        LEFT JOIN LATERAL (
          SELECT evidence.client FROM client_evidence evidence
           WHERE evidence.user_id = facts.user_id
             AND facts.oauth_client_id IS NOT NULL
             AND evidence.oauth_client_id = facts.oauth_client_id
             AND evidence.observed_at <= facts.observed_at
           ORDER BY evidence.priority, evidence.observed_at DESC, evidence.client
           LIMIT 1
        ) identity ON TRUE
        ${relations.profiles ? 'LEFT JOIN profiles profile ON profile.id::text = facts.user_id' : ''}
    )
    SELECT COALESCE(client, 'all') AS client,
      COUNT(DISTINCT user_id) FILTER (WHERE kind = 'account')::bigint AS accounts,
      (ARRAY_AGG(DISTINCT user_id) FILTER (WHERE kind = 'account' AND NOT profile_known))[1:101] AS missing_user_ids,
      (ARRAY_AGG(DISTINCT oauth_client_id) FILTER (WHERE client = 'other' AND oauth_client_id IS NOT NULL))[1:101] AS unknown_client_ids,
      COUNT(DISTINCT user_id) FILTER (WHERE kind = 'account' AND NOT profile_known)::bigint AS missing_profiles,
      COUNT(DISTINCT user_id) FILTER (WHERE kind = 'account' AND profile_known
        AND registered_at >= $1 AND registered_at < $2)::bigint AS new_signups,
      COUNT(DISTINCT user_id) FILTER (WHERE kind = 'video' AND status = 'completed')::bigint AS generators,
      COUNT(DISTINCT job_id) FILTER (WHERE kind = 'video')::bigint AS submitted,
      COUNT(DISTINCT job_id) FILTER (WHERE kind = 'video' AND status = 'completed')::bigint AS videos,
      COUNT(DISTINCT job_id) FILTER (WHERE kind = 'video' AND status IN ('failed', 'error', 'cancelled', 'canceled'))::bigint AS failed,
      COUNT(DISTINCT job_id) FILTER (WHERE kind = 'video' AND status NOT IN ('completed', 'failed', 'error', 'cancelled', 'canceled'))::bigint AS pending
    FROM attributed GROUP BY GROUPING SETS ((), (client))`;
}
