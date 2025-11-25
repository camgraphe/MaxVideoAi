export type TimeSeriesPoint = {
  date: string;
  value: number;
};

export type AmountSeriesPoint = {
  date: string;
  count: number;
  amountCents: number;
};

export type MonthlyPoint = TimeSeriesPoint;
export type MonthlyAmountPoint = AmountSeriesPoint;

export type MetricsRangeLabel = '7d' | '30d' | '90d';

export type MetricsRange = {
  label: MetricsRangeLabel;
  days: number;
  from: string;
  to: string;
};

export type EngineUsage = {
  engineId: string;
  engineLabel: string;
  rendersCount30d: number;
  rendersAmount30dUsd: number;
  distinctUsers30d: number;
  shareOfTotalRenders30d: number;
  shareOfTotalRevenue30d: number;
  avgSpendPerUser30d: number;
};

export type WhaleUser = {
  userId: string;
  identifier: string;
  lifetimeTopupUsd: number;
  lifetimeChargeUsd: number;
  renderCount: number;
  firstSeenAt: string | null;
  lastActiveAt: string | null;
};

export type FailedEngineStat = {
  engineId: string;
  engineLabel: string;
  failedCount30d: number;
  failureRate30d: number;
};

export type FunnelMetrics = {
  signupToTopUpConversion: number;
  topUpToRenderConversion30d: number;
  avgTimeSignupToFirstTopUpDays: number | null;
  avgTimeTopUpToFirstRenderDays: number | null;
};

export type BehaviorMetrics = {
  avgRendersPerPayingUser30d: number;
  medianRendersPerPayingUser30d: number;
  returningUsers7d: number;
  whalesTop10: WhaleUser[];
};

export type HealthMetrics = {
  failedRenders30d: number;
  failedRendersRate30d: number;
  failedByEngine30d: FailedEngineStat[];
};

export type AdminMetrics = {
  totals: {
    totalAccounts: number;
    payingAccounts: number;
    activeAccounts30d: number;
    allTimeTopUpsUsd: number;
    allTimeRenderChargesUsd: number;
  };
  range: MetricsRange;
  timeseries: {
    signupsDaily: TimeSeriesPoint[];
    activeAccountsDaily: TimeSeriesPoint[];
    topupsDaily: AmountSeriesPoint[];
    chargesDaily: AmountSeriesPoint[];
  };
  monthly: {
    signupsMonthly: MonthlyPoint[];
    topupsMonthly: MonthlyAmountPoint[];
    chargesMonthly: MonthlyAmountPoint[];
  };
  engines: EngineUsage[];
  funnels: FunnelMetrics;
  behavior: BehaviorMetrics;
  health: HealthMetrics;
};

export type EngineHealthStat = {
  engineId: string;
  engineLabel: string;
  failedCount: number;
  totalCount: number;
  failureRate: number;
};

export type AdminHealthSnapshot = {
  failedRenders24h: number;
  stalePendingJobs: number;
  serviceNotice: {
    active: boolean;
    message: string | null;
  };
  engineStats: EngineHealthStat[];
};
