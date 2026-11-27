export const ROUTING_TRAFFIC_JOB_LIMIT = 512;

export type RoutingTrafficEvent = {
  engineId: string;
  provider: string;
  status: string;
  stage: 'primary' | 'fallback' | 'attempt' | 'job';
  previousProvider: string | null;
  at: string;
};

export type RoutingTrafficRoute = {
  engineId: string;
  provider: string;
  attempts: number;
  jobsOnly: number;
  fallbacks: number;
  failed: number;
  uncertain: number;
  latestAt: string;
};

export type RoutingEngineUsage = {
  engineId: string;
  jobs: number;
  jobsWithFallback: number;
};

export type RoutingTrafficSnapshot = {
  observedAt: string;
  windowMinutes: number;
  sampledJobs: number;
  engineUsage?: RoutingEngineUsage[];
  truncated: boolean;
  routes: RoutingTrafficRoute[];
  events: RoutingTrafficEvent[];
};
