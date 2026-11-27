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

export type RoutingTrafficSnapshot = {
  observedAt: string;
  windowMinutes: number;
  sampledJobs: number;
  truncated: boolean;
  routes: RoutingTrafficRoute[];
  events: RoutingTrafficEvent[];
};
