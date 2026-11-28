import { ROUTING_TRAFFIC_JOB_LIMIT, type RoutingEngineUsage } from '../_lib/routing-traffic-types';

export function EngineUsage({ engines, sampledJobs, windowMinutes, truncated, labels }: {
  engines: RoutingEngineUsage[];
  sampledJobs: number;
  windowMinutes: number;
  truncated: boolean;
  labels: Map<string, string>;
}) {
  function rows(group: RoutingEngineUsage[]) {
    return group.map(({ engineId, jobs, jobsWithFallback }) => (
      <li key={engineId} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4 gap-y-1">
        <span className="break-words text-sm font-medium">{labels.get(engineId) ?? engineId}</span>
        <span className="text-right text-xs tabular-nums text-text-secondary">
          <strong className="text-text-primary">{jobs} {jobs === 1 ? 'job' : 'jobs'}</strong>
          {jobsWithFallback > 0 && <> · {jobsWithFallback} with fallback</>}
        </span>
        <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-hairline" aria-hidden="true">
          <span className="block h-full rounded-full bg-cyan-600 dark:bg-cyan-400" style={{ width: `${100 * jobs / sampledJobs}%` }} />
        </span>
      </li>
    ));
  }

  return (
    <section className="rounded-card border border-hairline bg-surface p-5" aria-labelledby="routing-engine-usage">
      <h3 id="routing-engine-usage" className="text-base font-semibold">Engines in this sample</h3>
      <p className="mt-1 text-sm text-text-secondary">
        {sampledJobs} distinct video {sampledJobs === 1 ? 'job' : 'jobs'} created in the last {windowMinutes} minutes.
        {' '}Sampled from the latest {ROUTING_TRAFFIC_JOB_LIMIT} job records across all surfaces.{truncated && ' Sample limits reached.'}
      </p>
      {engines.length > 0 && (
        <ol className="mt-4 grid gap-3">{rows(engines.slice(0, 6))}</ol>
      )}
      {engines.length > 6 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-text-secondary">Show {engines.length - 6} more engines</summary>
          <ol start={7} className="mt-3 grid gap-3">{rows(engines.slice(6))}</ol>
        </details>
      )}
    </section>
  );
}
