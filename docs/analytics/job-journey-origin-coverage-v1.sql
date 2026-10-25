-- MEAS-01 aggregate projection v1. Read-only; no production execution is implied.
-- Requires the proposed migration. Bind $1=start UTC, $2=end exclusive UTC,
-- $3=private text[] static admin exclusions; never save parameter values in OUTREACH.
-- Current statuses grouped by creation, not a historical status replay or completion clock.
WITH bounds AS (
 SELECT $1::timestamptz starting, $2::timestamptz ending
), excluded AS (
 SELECT unnest($3::text[]) user_id
 UNION SELECT user_id::text FROM app_admins
 UNION SELECT user_id::text FROM user_roles WHERE role::text IN ('admin','super_admin','staff','internal')
), flagged AS (
 SELECT user_id FROM user_account_restrictions WHERE active
 UNION SELECT user_id FROM wallet_fraud_cleanup_audit
), jobs AS MATERIALIZED (
 SELECT j.*, EXISTS(SELECT 1 FROM flagged f WHERE f.user_id=j.user_id) documented_flag,
   (COALESCE(j.surface IN ('video','image'),false)
     AND COALESCE(j.payment_status,'')<>'included_mcp_trial'
     AND COALESCE(j.settings_snapshot->>'origin','')<>'external_fal_import') covered_media_candidate,
   NOT (j.entry_surface IS NULL AND j.entry_source IS NULL AND j.journey_version IS NULL AND j.entry_release_sha IS NULL) context_present,
   COALESCE(j.journey_version=1
    AND ((j.entry_surface='generator' AND j.entry_source='web_route')
      OR (j.entry_surface IN ('tool','studio','mcp') AND j.entry_source='confirmed_actor')
      OR (j.entry_surface='unknown' AND j.entry_source='unknown'))
    AND (j.entry_release_sha IS NULL OR j.entry_release_sha ~ '^[0-9a-f]{40}$'),false) context_valid
 FROM app_jobs j,bounds
 WHERE j.created_at>=starting AND j.created_at<ending AND starting<ending
   AND j.user_id IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM excluded e WHERE e.user_id=j.user_id)
), quote_facts AS (
 SELECT j.user_id,j.job_id,
   count(DISTINCT q.auth_origin) origins,
   bool_or(q.auth_origin IS NOT NULL AND q.auth_origin NOT IN ('oauth','studio-session','toolbox-session')) invalid_origin,
   CASE min(q.auth_origin) WHEN 'oauth' THEN 'mcp' WHEN 'studio-session' THEN 'studio'
     WHEN 'toolbox-session' THEN 'tool' ELSE NULL END quote_surface
 FROM jobs j JOIN mcp_generation_quotes q ON q.user_id=j.user_id AND q.job_id=j.job_id
 CROSS JOIN bounds
 WHERE q.created_at<ending AND q.funding_mode='wallet' AND q.state IN ('accepted','failed')
 GROUP BY j.user_id,j.job_id
), resolved AS (
 SELECT j.*,q.origins,q.invalid_origin,q.quote_surface,
   CASE WHEN NOT covered_media_candidate THEN 'out_of_scope'
    WHEN context_present AND NOT context_valid THEN 'inconsistent'
    WHEN q.origins>1 THEN 'conflict'
    WHEN q.invalid_origin THEN 'inconsistent'
    WHEN context_valid AND entry_surface<>'unknown' AND q.quote_surface IS NOT NULL
      AND entry_surface<>q.quote_surface THEN 'conflict'
    WHEN context_valid THEN entry_surface
    WHEN q.quote_surface IS NOT NULL THEN q.quote_surface
    ELSE 'unknown' END resolved_surface
 FROM jobs j LEFT JOIN quote_facts q ON q.user_id=j.user_id AND q.job_id=j.job_id
), projection AS (
 SELECT r.*,
   CASE WHEN resolved_surface IN ('out_of_scope','inconsistent','conflict') THEN resolved_surface
    WHEN context_valid THEN 'job_context_v1'
    WHEN quote_surface IS NOT NULL THEN 'quote_history'
    ELSE 'no_evidence' END evidence_source,
   CASE WHEN context_valid THEN entry_release_sha ELSE NULL END known_reservation_release
 FROM resolved r
), scopes(scope) AS (VALUES ('all_non_admin'),('without_documented_flags'))
SELECT scope,surface AS media_surface,payment_status,resolved_surface,evidence_source,
 journey_version,known_reservation_release,
 count(*) jobs,count(DISTINCT user_id) accounts,
 count(*) FILTER(WHERE status='completed' AND payment_status='paid_wallet') observed_paid_completed_jobs,
 count(*) FILTER(WHERE NOT context_present) missing_job_context,
 count(*) FILTER(WHERE context_valid AND entry_surface='unknown') explicit_unknown_job_context,
 count(*) FILTER(WHERE context_valid AND entry_release_sha IS NULL) missing_reservation_release,
 count(*) FILTER(WHERE updated_at>=(SELECT ending FROM bounds)) updated_after_cutoff
FROM projection CROSS JOIN scopes
WHERE scope='all_non_admin' OR NOT documented_flag
GROUP BY scope,surface,payment_status,resolved_surface,evidence_source,journey_version,known_reservation_release
ORDER BY scope,media_surface,payment_status,resolved_surface,evidence_source,journey_version,known_reservation_release
