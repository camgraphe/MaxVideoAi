export const FUNNEL_SQL = `/* admin-mcp:funnel */
  WITH window_events AS (
    SELECT event_type, stage, user_id, acquisition_client, quote_id, job_id, occurred_at
      FROM mcp_funnel_events
     WHERE occurred_at >= $1 AND occurred_at < $2
  ), trial_cohort AS (
    SELECT MIN(occurred_at) AS trial_at, user_id
      FROM window_events
     WHERE event_type = 'trial_generation_completed' AND user_id IS NOT NULL
     GROUP BY user_id
  ), funded_after_trial AS (
    SELECT COUNT(DISTINCT cohort.user_id)::bigint AS count
      FROM trial_cohort cohort
      JOIN mcp_funnel_events funded ON funded.user_id = cohort.user_id
       AND funded.event_type = 'wallet_funded'
       AND funded.occurred_at > cohort.trial_at
       AND funded.occurred_at <= cohort.trial_at + ($3 * INTERVAL '1 second')
  ), prepared_quotes AS (
    SELECT quote_id, MIN(occurred_at) AS prepared_at
      FROM window_events
     WHERE event_type IN ('trial_quote_prepared', 'paid_quote_prepared') AND quote_id IS NOT NULL
     GROUP BY quote_id
  ), confirmed_quotes AS (
    SELECT prepared.quote_id
      FROM prepared_quotes prepared
     WHERE EXISTS (
       SELECT 1
         FROM window_events accepted
        WHERE accepted.quote_id = prepared.quote_id
          AND accepted.event_type IN ('trial_generation_accepted', 'paid_generation_accepted')
          AND accepted.occurred_at > prepared.prepared_at
     )
  ), prepared_trial_quotes AS (
    SELECT quote_id, MIN(occurred_at) AS prepared_at
      FROM window_events
     WHERE event_type = 'trial_quote_prepared' AND quote_id IS NOT NULL
     GROUP BY quote_id
  ), accepted_trial_quotes AS (
    SELECT prepared.quote_id, MIN(accepted.occurred_at) AS accepted_at
      FROM prepared_trial_quotes prepared
      JOIN window_events accepted ON accepted.quote_id = prepared.quote_id
       AND accepted.event_type = 'trial_generation_accepted'
       AND accepted.occurred_at > prepared.prepared_at
     GROUP BY prepared.quote_id
  ), released_trial_quotes AS (
    SELECT accepted.quote_id
      FROM accepted_trial_quotes accepted
     WHERE EXISTS (
       SELECT 1
         FROM window_events released
        WHERE released.quote_id = accepted.quote_id
          AND released.event_type = 'trial_generation_released'
          AND released.occurred_at > accepted.accepted_at
     )
  )
  SELECT
    COUNT(DISTINCT user_id) FILTER (WHERE stage = 'oauth_connected')::bigint AS oauth_connected,
    COUNT(DISTINCT user_id) FILTER (WHERE stage = 'trial_prepared')::bigint AS trial_prepared,
    COUNT(DISTINCT user_id) FILTER (WHERE stage = 'trial_completed')::bigint AS trial_completed,
    COUNT(DISTINCT user_id) FILTER (WHERE stage = 'wallet_funded')::bigint AS wallet_funded,
    COUNT(DISTINCT user_id) FILTER (WHERE stage = 'first_paid_generation')::bigint AS first_paid_generation,
    COUNT(DISTINCT user_id) FILTER (WHERE stage = 'repeat_paid_generation')::bigint AS repeat_paid_generation,
    (SELECT COUNT(*)::bigint FROM trial_cohort) AS completed_trial_users,
    (SELECT count FROM funded_after_trial) AS funded_after_trial_users,
    COUNT(*) FILTER (WHERE event_type = 'oauth_connection_completed' AND acquisition_client = 'chatgpt')::bigint AS chatgpt_connections,
    COUNT(*) FILTER (WHERE event_type = 'oauth_connection_completed' AND acquisition_client = 'claude')::bigint AS claude_connections,
    COUNT(*) FILTER (WHERE event_type = 'oauth_connection_completed' AND acquisition_client = 'codex')::bigint AS codex_connections,
    COUNT(*) FILTER (WHERE event_type = 'oauth_connection_completed' AND acquisition_client = 'other')::bigint AS other_connections,
    (SELECT COUNT(*)::bigint FROM prepared_quotes) AS quote_prepared,
    (SELECT COUNT(*)::bigint FROM confirmed_quotes) AS quote_confirmed,
    COUNT(*) FILTER (WHERE event_type = 'trial_quote_prepared')::bigint AS trial_volume,
    (SELECT COUNT(*)::bigint FROM accepted_trial_quotes) AS trial_accepted,
    (SELECT COUNT(*)::bigint FROM released_trial_quotes) AS trial_released
  FROM window_events`;

export const AUDIT_SUMMARY_SQL = `/* admin-mcp:audit-summary */
  WITH first_connections AS (
    SELECT MIN(created_at) AS first_connected_at, user_id
      FROM mcp_audit_events
     WHERE event_type = 'connection_initialized'
     GROUP BY user_id
  ), window_events AS (
    SELECT audit.event_type, audit.user_id, audit.tool_name, audit.outcome,
           audit.error_code, first_connections.first_connected_at
      FROM mcp_audit_events audit
      LEFT JOIN first_connections ON first_connections.user_id = audit.user_id
     WHERE audit.created_at >= $1 AND audit.created_at < $2
  )
  SELECT
    COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'connection_initialized')::bigint AS connected_users,
    COUNT(DISTINCT user_id) FILTER (
      WHERE event_type = 'connection_initialized'
        AND first_connected_at >= $1 AND first_connected_at < $2
    )::bigint AS new_connected_users,
    COUNT(*) FILTER (WHERE event_type = 'connection_initialized')::bigint AS connection_events,
    COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'tool_call')::bigint AS active_tool_users,
    COUNT(*) FILTER (WHERE event_type = 'tool_call')::bigint AS tool_calls,
    COUNT(*) FILTER (WHERE event_type = 'tool_call' AND outcome = 'success')::bigint AS successful_tool_calls,
    COUNT(*) FILTER (WHERE event_type = 'tool_call' AND outcome = 'failure')::bigint AS failed_tool_calls,
    COUNT(*) FILTER (
      WHERE event_type = 'tool_call' AND tool_name = 'get_generation_status'
    )::bigint AS polling_calls,
    COUNT(*) FILTER (
      WHERE event_type = 'tool_call'
        AND tool_name = 'create_reference_upload_link'
        AND outcome = 'failure'
    )::bigint AS upload_failures,
    COUNT(*) FILTER (
      WHERE event_type = 'tool_call'
        AND outcome = 'failure'
        AND COALESCE(error_code, '') ~* '(refund|restore|restoration|release)'
    )::bigint AS refund_restoration_failures
  FROM window_events`;

export const RECOMMENDATION_TO_QUOTE_SQL = `/* admin-mcp:recommendation-to-quote */
  WITH recommendations AS (
    SELECT MIN(created_at) AS first_recommended_at, user_id
      FROM mcp_audit_events
     WHERE created_at >= $1 AND created_at < $2
       AND event_type = 'tool_call'
       AND tool_name = 'recommend_models'
       AND outcome = 'success'
     GROUP BY user_id
  )
  SELECT
    COUNT(DISTINCT recommendations.user_id)::bigint AS recommended_users,
    COUNT(DISTINCT recommendations.user_id) FILTER (
      WHERE EXISTS (
        SELECT 1
          FROM mcp_funnel_events quote
         WHERE quote.user_id = recommendations.user_id
           AND quote.occurred_at >= $1 AND quote.occurred_at < $2
           AND quote.event_type IN ('trial_quote_prepared', 'paid_quote_prepared')
           AND quote.occurred_at > recommendations.first_recommended_at
      )
    )::bigint AS recommended_to_quote_users
  FROM recommendations`;

export const ERROR_SQL = `/* admin-mcp:errors */
  SELECT COALESCE(error_code, 'UNKNOWN') AS code, COUNT(*)::bigint AS count
  FROM mcp_audit_events
  WHERE event_type = 'tool_call'
    AND created_at >= $1 AND created_at < $2
    AND outcome = 'failure'
  GROUP BY COALESCE(error_code, 'UNKNOWN')
  ORDER BY count DESC, code ASC
  LIMIT 20`;

export const TOOL_USAGE_SQL = `/* admin-mcp:tool-usage */
  SELECT
    tool_name AS tool,
    COUNT(*)::bigint AS calls,
    COUNT(DISTINCT user_id)::bigint AS users,
    COUNT(*) FILTER (WHERE outcome = 'failure')::bigint AS failures
  FROM mcp_audit_events
  WHERE event_type = 'tool_call'
    AND created_at >= $1 AND created_at < $2
    AND tool_name IS NOT NULL
  GROUP BY tool_name
  ORDER BY calls DESC, tool_name ASC
  LIMIT 20`;

export const RECEIPTS_SQL = `/* admin-mcp:receipts */
  WITH mcp_jobs AS (
    SELECT DISTINCT job_id FROM mcp_funnel_events
    WHERE event_type = 'paid_generation_accepted'
      AND job_id IS NOT NULL
  ), scoped AS (
    SELECT receipt.type, receipt.amount_cents, receipt.currency, receipt.job_id
    FROM app_receipts receipt JOIN mcp_jobs ON mcp_jobs.job_id = receipt.job_id
    WHERE receipt.created_at >= $1 AND receipt.created_at < $2
  )
  SELECT
    COALESCE(SUM(amount_cents) FILTER (WHERE type = 'charge'), 0)::bigint AS revenue_cents,
    COALESCE(SUM(amount_cents) FILTER (WHERE type = 'refund'), 0)::bigint AS refunds_cents,
    COUNT(DISTINCT job_id) FILTER (WHERE type = 'charge')::bigint AS charged_jobs,
    COUNT(DISTINCT job_id) FILTER (WHERE type = 'refund')::bigint AS refunded_jobs,
    COUNT(*) FILTER (WHERE type IN ('charge', 'refund') AND currency IS DISTINCT FROM 'USD')::bigint AS non_usd_receipts
  FROM scoped`;

export const PROVIDER_COST_SQL = `/* admin-mcp:provider-costs */
  WITH mcp_jobs AS (
    SELECT job_id, BOOL_OR(event_type LIKE 'trial_%') AS is_trial
    FROM mcp_funnel_events
    WHERE job_id IS NOT NULL
    GROUP BY job_id
  ), attempt_costs AS (
    SELECT attempt.provider_cost_usd AS cost_usd, mcp_jobs.is_trial
    FROM mcp_jobs
    JOIN app_jobs job ON job.job_id = mcp_jobs.job_id
    JOIN provider_attempts attempt ON attempt.job_id = job.id
    WHERE attempt.created_at >= $1 AND attempt.created_at < $2
  )
  SELECT
    COUNT(*)::bigint AS attempt_count,
    COUNT(*) FILTER (WHERE is_trial)::bigint AS trial_attempt_count,
    COUNT(*) FILTER (WHERE cost_usd IS NULL)::bigint AS missing_cost_attempts,
    ROUND(SUM(cost_usd) * 100)::bigint AS provider_cost_cents,
    ROUND(SUM(cost_usd) FILTER (WHERE is_trial) * 100)::bigint AS trial_cost_cents
  FROM attempt_costs`;
