export type JobsRouteTimingPhase =
  | 'schema'
  | 'auth'
  | 'list'
  | 'stale_audio'
  | 'fal_refresh'
  | 'outputs'
  | 'starter_fallback';

type JobsRouteTimingOptions = {
  enabled: boolean;
  now?: () => number;
};

const MAX_DURATION_MS = 120_000;

function formatDuration(value: number): string {
  const bounded = Math.min(MAX_DURATION_MS, Math.max(0, value));
  return bounded.toFixed(1);
}

export function createJobsRouteTiming({
  enabled,
  now = () => performance.now(),
}: JobsRouteTimingOptions) {
  const requestStartedAt = enabled ? now() : 0;
  const phases: Array<{ name: JobsRouteTimingPhase; durationMs: number }> = [];

  return {
    async measure<TResult>(name: JobsRouteTimingPhase, operation: () => Promise<TResult>): Promise<TResult> {
      if (!enabled) return operation();
      const startedAt = now();
      try {
        return await operation();
      } finally {
        phases.push({ name, durationMs: now() - startedAt });
      }
    },
    headerValue(): string | null {
      if (!enabled) return null;
      const values = phases.map(({ name, durationMs }) => `${name};dur=${formatDuration(durationMs)}`);
      values.push(`total;dur=${formatDuration(now() - requestStartedAt)}`);
      return values.join(', ');
    },
  };
}
