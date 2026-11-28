import { isDatabaseConfigured, query, type QueryExecutor } from '@/lib/db';
import { ROUTING_TRAFFIC_JOB_LIMIT, type RoutingEngineUsage, type RoutingTrafficEvent, type RoutingTrafficRoute, type RoutingTrafficSnapshot } from './routing-traffic-types';

const WINDOW_MINUTES = 60;
const ATTEMPT_LIMIT = 8;
const EVENT_LIMIT = 48;

type TrafficRow = {
  observed_at: Date;
  more_recent_jobs: boolean;
  engine_id: string | null;
  owner: string | null;
  job_status: string | null;
  job_at: Date | null;
  ledger: Omit<RoutingTrafficEvent, 'engineId'>[] | null;
};

// Scan a bounded tail of the primary key before filtering by surface or age.
// Each sampled job probes its indexed attempts. Neither snapshots nor remote IDs cross the read boundary.
const trafficQuery = `
  WITH latest AS MATERIALIZED (
    SELECT id, engine_id, surface, provider, status, created_at, updated_at,
      NULLIF(BTRIM(provider_job_id), '') IS NOT NULL AS has_remote_task
    FROM app_jobs ORDER BY id DESC LIMIT ($1::integer + 1)
  ), recent AS (
    SELECT * FROM (SELECT * FROM latest ORDER BY id DESC LIMIT $1) tail
    WHERE surface = 'video' AND created_at BETWEEN NOW() - make_interval(mins => $2) AND NOW()
  ), sample AS (
    SELECT COALESCE((SELECT created_at >= NOW() - make_interval(mins => $2)
      FROM latest ORDER BY id DESC OFFSET $1 LIMIT 1), false) AS more_recent_jobs
  )
  SELECT NOW() AS observed_at, sample.more_recent_jobs, j.engine_id,
    CASE WHEN j.has_remote_task THEN NULLIF(BTRIM(j.provider), '') END AS owner,
    j.status AS job_status, COALESCE(j.updated_at, j.created_at) AS job_at, ledger.entries AS ledger
  FROM sample LEFT JOIN recent j ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'provider', a.provider, 'status', a.status, 'at', CASE
        WHEN a.status IN ('completed','failed') THEN COALESCE(a.finished_at, a.updated_at)
        WHEN a.status = 'accepted' THEN COALESCE(a.accepted_at, a.updated_at)
        WHEN a.status IN ('submit_started','fallback_started') THEN COALESCE(a.started_at, a.created_at)
        ELSE a.updated_at END,
      'stage', CASE WHEN prior.id IS NOT NULL OR (a.attempt_index > 1 AND a.status = 'fallback_started') THEN 'fallback'
        WHEN a.attempt_index = 1 THEN 'primary' ELSE 'attempt' END,
      'previousProvider', prior.provider
    ) ORDER BY a.attempt_index DESC) AS entries FROM (
      SELECT id, job_id, provider, status, attempt_index, finished_at, accepted_at, started_at, updated_at, created_at
      FROM provider_attempts WHERE job_id = j.id ORDER BY attempt_index DESC LIMIT ($3::integer + 1)
    ) a LEFT JOIN provider_attempts prior ON prior.job_id = a.job_id
      AND prior.attempt_index = a.attempt_index - 1 AND prior.fallback_to_attempt_id = a.id
      AND prior.provider <> a.provider
  ) ledger ON true
`;

export async function loadRoutingTrafficSnapshot(execute: QueryExecutor['query']): Promise<RoutingTrafficSnapshot> {
  const rows = await execute<TrafficRow>(trafficQuery, [ROUTING_TRAFFIC_JOB_LIMIT, WINDOW_MINUTES, ATTEMPT_LIMIT]);
  const observedAt = rows[0].observed_at.toISOString();
  const events: RoutingTrafficEvent[] = [];
  let truncated = rows[0].more_recent_jobs;
  let sampledJobs = 0;
  const usage = new Map<string, RoutingEngineUsage>();
  for (const row of rows) {
    if (!row.engine_id) continue; // The metadata row also represents an empty window.
    sampledJobs++;
    const engine = usage.get(row.engine_id) ?? { engineId: row.engine_id, jobs: 0, jobsWithFallback: 0 };
    engine.jobs++;
    usage.set(row.engine_id, engine);
    if (row.ledger?.length) {
      if (row.ledger.length > ATTEMPT_LIMIT) truncated = true;
      const attempts = row.ledger.slice(0, ATTEMPT_LIMIT);
      if (attempts.some(attempt => attempt.stage === 'fallback')) engine.jobsWithFallback++;
      for (const entry of attempts) {
        events.push({ ...entry, engineId: row.engine_id, at: new Date(entry.at).toISOString() });
      }
    } else if (row.owner && row.job_status && row.job_at) {
      events.push({ engineId: row.engine_id, provider: row.owner, status: row.job_status, at: row.job_at.toISOString(),
        stage: 'job', previousProvider: null });
    }
  }
  events.sort((a, b) => b.at.localeCompare(a.at) || a.engineId.localeCompare(b.engineId)
    || a.provider.localeCompare(b.provider) || a.stage.localeCompare(b.stage) || a.status.localeCompare(b.status)
    || (a.previousProvider ?? '').localeCompare(b.previousProvider ?? ''));
  const routes = new Map<string, RoutingTrafficRoute>();
  for (const event of events) {
    const key = JSON.stringify([event.engineId, event.provider]);
    const route = routes.get(key) ?? { engineId: event.engineId, provider: event.provider, attempts: 0, jobsOnly: 0,
      fallbacks: 0, failed: 0, uncertain: 0, latestAt: event.at };
    if (event.stage === 'job') route.jobsOnly++;
    else route.attempts++;
    if (event.stage === 'fallback') route.fallbacks++;
    if (event.status === 'failed') route.failed++;
    if (event.status === 'polling_stalled' || event.status === 'provider_polling_stalled') route.uncertain++;
    routes.set(key, route);
  }
  const engineUsage = [...usage.values()].sort((a, b) => b.jobs - a.jobs || a.engineId.localeCompare(b.engineId));
  return { observedAt, sampledJobs, engineUsage, truncated, windowMinutes: WINDOW_MINUTES, routes: [...routes.values()],
    events: events.slice(0, EVENT_LIMIT) };
}

export async function readRoutingTraffic(): Promise<RoutingTrafficSnapshot | null> {
  if (!isDatabaseConfigured()) return null;
  return loadRoutingTrafficSnapshot(query);
}
