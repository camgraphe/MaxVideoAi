export type InfraCostAlertLevel = 'ok' | 'warning' | 'critical';
export type InfraCostProviderId = 'neon' | 'vercel';

export type InfraCostPeriod = {
  startIso: string;
  endIso: string;
  monthEndIso: string;
  elapsedRatio: number;
  projectionFactor: number;
};

export type InfraCostMoneySummary = {
  currentUsd: number;
  projectedMonthUsd: number;
  currency: 'USD';
  source: 'actual' | 'estimated' | 'partial' | 'unconfigured';
};

export type InfraCostAlert = {
  provider: InfraCostProviderId | 'total';
  level: Exclude<InfraCostAlertLevel, 'ok'>;
  kind: 'configuration' | 'cost' | 'usage' | 'branch';
  title: string;
  detail: string;
  currentUsd?: number;
  projectedMonthUsd?: number;
  thresholdUsd?: number;
};

export type NeonUsageTotals = {
  computeCuHours: number;
  rootBranchGbMonth: number;
  childBranchGbMonth: number;
  instantRestoreGbMonth: number;
  snapshotStorageGbMonth: number;
  publicTransferGb: number;
  privateTransferGb: number;
  extraBranchesMonth: number;
  currentBranchCount: number | null;
};

export type NeonUsageCostBreakdown = {
  computeUsd: number;
  storageUsd: number;
  instantRestoreUsd: number;
  snapshotStorageUsd: number;
  publicTransferUsd: number;
  privateTransferUsd: number;
  extraBranchUsd: number;
};

export type NeonBranchSummary = {
  projectId: string;
  total: number;
  primary: number;
  nonPrimary: number;
  byState: Record<string, number>;
  oldestNonPrimaryCreatedAt: string | null;
};

export type NeonDailyUsageRow = {
  date: string;
  projectId: string;
  computeCuHours: number;
  publicTransferGb: number;
  privateTransferGb: number;
  extraBranchesMonth: number;
  estimatedUsd: number;
};

export type NeonInfraCostDetails = {
  orgId: string;
  projectIds: string[];
  plan: 'launch' | 'scale';
  branchGuardLimit: number;
  includedPublicTransferGb: number;
  rates: {
    computeCuHourUsd: number;
    storageGbMonthUsd: number;
    instantRestoreGbMonthUsd: number;
    snapshotStorageGbMonthUsd: number;
    extraBranchMonthUsd: number;
    publicTransferGbUsd: number;
    privateTransferGbUsd: number;
    includedPublicTransferGb: number;
  };
  totals: NeonUsageTotals;
  projectedTotals: NeonUsageTotals;
  costBreakdown: NeonUsageCostBreakdown;
  projectedCostBreakdown: NeonUsageCostBreakdown;
  branches: NeonBranchSummary[];
  dailyRows: NeonDailyUsageRow[];
};

export type VercelChargeRow = {
  serviceName: string;
  serviceCategory: string | null;
  projectId: string | null;
  projectName: string | null;
  chargeCategory: string;
  billedUsd: number;
  effectiveUsd: number;
  consumedQuantity: number;
  consumedUnit: string;
  periodStart: string;
  periodEnd: string;
};

export type VercelAggregateRow = {
  key: string;
  label: string;
  currentUsd: number;
  projectedMonthUsd: number;
  chargeCount: number;
};

export type VercelDailyCostRow = {
  date: string;
  billedUsd: number;
  effectiveUsd: number;
};

export type VercelInfraCostDetails = {
  teamId: string | null;
  teamSlug: string | null;
  chargesCount: number;
  effectiveCurrentUsd: number;
  serviceRows: VercelAggregateRow[];
  projectRows: VercelAggregateRow[];
  dailyRows: VercelDailyCostRow[];
};

export type InfraCostProviderReport<TDetails> = {
  id: InfraCostProviderId;
  label: string;
  configured: boolean;
  status: InfraCostAlertLevel;
  money: InfraCostMoneySummary;
  error: string | null;
  setup: string[];
  details: TDetails | null;
};

export type InfraCostThresholds = {
  monthlyWarningUsd: number;
  monthlyCriticalUsd: number;
  neonMonthlyWarningUsd: number;
  neonMonthlyCriticalUsd: number;
  vercelMonthlyWarningUsd: number;
  vercelMonthlyCriticalUsd: number;
};

export type InfraCostsReport = {
  generatedAtIso: string;
  period: InfraCostPeriod;
  money: InfraCostMoneySummary;
  alertLevel: InfraCostAlertLevel;
  notificationLevel: InfraCostAlertLevel;
  alerts: InfraCostAlert[];
  thresholds: InfraCostThresholds;
  providers: {
    neon: InfraCostProviderReport<NeonInfraCostDetails>;
    vercel: InfraCostProviderReport<VercelInfraCostDetails>;
  };
  notifications: {
    emailConfigured: boolean;
    slackConfigured: boolean;
  };
};

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
export type EnvLike = Record<string, string | undefined>;
