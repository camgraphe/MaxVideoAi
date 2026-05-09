import type {
  GscDateWindows,
  GscOpportunity,
  GscPerformanceRow,
  GscPerformanceSummary,
  GscRangeKey,
} from '@/lib/seo/gsc-analysis';

export type GscAccessToken = {
  token: string;
  expiresAt: number;
  cacheKey: string;
};

export type GscSearchAnalyticsResponse = {
  rows?: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }>;
  metadata?: {
    first_incomplete_date?: string;
    first_incomplete_hour?: string;
  };
};

export type GscUrlInspectionApiResult = {
  inspectionResultLink?: string;
  indexStatusResult?: {
    sitemap?: string[];
    referringUrls?: string[];
    verdict?: string;
    coverageState?: string;
    robotsTxtState?: string;
    indexingState?: string;
    lastCrawlTime?: string;
    pageFetchState?: string;
    googleCanonical?: string;
    userCanonical?: string;
    crawledAs?: string;
  };
  ampResult?: unknown;
  mobileUsabilityResult?: {
    verdict?: string;
    issues?: unknown[];
  };
  richResultsResult?: {
    verdict?: string;
    detectedItems?: Array<{ richResultType?: string; items?: unknown[] }>;
    issues?: unknown[];
  };
};

export type GscClientConfig = {
  siteUrl: string;
} & (
  | {
      authType: 'service-account';
      clientEmail: string;
      privateKey: string;
    }
  | {
      authType: 'oauth-refresh-token';
      clientId: string;
      clientSecret: string;
      refreshToken: string;
    }
);

export type GscFamilySummary = {
  family: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  rows: number;
};

export type GscTrendPoint = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscComparisonSummary = GscPerformanceSummary & {
  previous: GscPerformanceSummary;
  clicksDelta: number;
  impressionsDelta: number;
  ctrDelta: number;
  positionDelta: number;
};

export type GscDashboardData = {
  ok: boolean;
  configured: boolean;
  range: GscRangeKey;
  siteUrl: string | null;
  fetchedAt: string | null;
  cacheAgeSeconds: number | null;
  error: string | null;
  windows: GscDateWindows;
  summary: GscComparisonSummary;
  detailSummary: GscPerformanceSummary;
  trend: GscTrendPoint[];
  topQueries: GscPerformanceRow[];
  topPages: GscPerformanceRow[];
  rows: GscPerformanceRow[];
  previousRows: GscPerformanceRow[];
  opportunities: GscOpportunity[];
  familySummaries: GscFamilySummary[];
  metadata: {
    firstIncompleteDate: string | null;
    firstIncompleteHour: string | null;
  };
};

export type GscDashboardCacheEntry = {
  version?: number;
  createdAt: number;
  data: GscDashboardData;
};
