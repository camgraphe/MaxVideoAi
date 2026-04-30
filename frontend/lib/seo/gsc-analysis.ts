export type GscSearchType = 'web' | 'image' | 'video';
export type GscDimension = 'query' | 'page' | 'country' | 'device' | 'searchAppearance' | 'date' | 'hour';
export type GscRangeKey = '24h' | '7d' | '28d' | '3m';
export type GscOpportunityPriority = 'P1' | 'P2' | 'P3';

export type GscApiRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export type GscPerformanceRow = {
  query: string | null;
  page: string | null;
  country: string | null;
  device: string | null;
  searchAppearance: string | null;
  date: string | null;
  searchType: GscSearchType;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscPerformanceSummary = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscDateWindow = {
  startDate: string;
  endDate: string;
};

export type GscDateWindows = {
  current: GscDateWindow;
  previous: GscDateWindow;
};

export type GscFamily =
  | 'Seedance'
  | 'Kling'
  | 'Veo'
  | 'LTX'
  | 'Pika'
  | 'Sora'
  | 'Wan'
  | 'Hailuo / Minimax'
  | 'Runway'
  | 'Luma'
  | 'Brand'
  | 'AI video pricing'
  | 'AI video examples'
  | 'Prompt examples'
  | 'Pay-as-you-go'
  | 'Other';

export type GscIntent =
  | 'brand'
  | 'compare'
  | 'pricing'
  | 'examples'
  | 'prompt examples'
  | 'pay-as-you-go'
  | 'specs'
  | 'tool'
  | 'generic';

export type GscOpportunity = {
  id: string;
  priority: GscOpportunityPriority;
  issueType:
    | 'high_impressions_low_ctr'
    | 'position_4_to_12'
    | 'top_position_zero_clicks'
    | 'dedicated_page_candidate'
    | 'internal_link_candidate';
  query: string | null;
  page: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  family: GscFamily;
  intent: GscIntent;
  suggestedAction: string;
  score: number;
};

const RANGE_DAYS: Record<GscRangeKey, number> = {
  '24h': 1,
  '7d': 7,
  '28d': 28,
  '3m': 90,
};

const FAMILY_PATTERNS: Array<{ family: GscFamily; patterns: RegExp[] }> = [
  { family: 'Seedance', patterns: [/\bseedance\b/i, /\bsea\s*dance\b/i] },
  { family: 'Kling', patterns: [/\bkling\b/i] },
  { family: 'Veo', patterns: [/\bveo\b/i, /\bgoogle\s+veo\b/i] },
  { family: 'LTX', patterns: [/\bltx\b/i] },
  { family: 'Pika', patterns: [/\bpika\b/i] },
  { family: 'Sora', patterns: [/\bsora\b/i] },
  { family: 'Wan', patterns: [/\bwan\b/i] },
  { family: 'Hailuo / Minimax', patterns: [/\bhailuo\b/i, /\bmini\s?max\b/i, /\bminimax\b/i] },
  { family: 'Runway', patterns: [/\brunway\b/i, /\bgen-?\d\b/i] },
  { family: 'Luma', patterns: [/\bluma\b/i, /\bray\s*2\b/i] },
  { family: 'Brand', patterns: [/\bmax\s*video\s*ai\b/i, /\bmaxvideoai\b/i, /\bmaxvideo\b/i, /\bmaxvideos\b/i, /\bmaxvedio\b/i] },
  { family: 'AI video pricing', patterns: [/\bpricing\b/i, /\bprice\b/i, /\bcost\b/i, /\bcredits?\b/i] },
  { family: 'AI video examples', patterns: [/\bexamples?\b/i, /\bsamples?\b/i, /\bgallery\b/i] },
  { family: 'Prompt examples', patterns: [/\bprompts?\b/i] },
  { family: 'Pay-as-you-go', patterns: [/\bpay\s*as\s*you\s*go\b/i, /\bno\s+subscription\b/i, /\bwithout\s+subscription\b/i] },
];

export function normalizeGscRange(candidate?: string | null): GscRangeKey {
  const normalized = candidate?.trim().toLowerCase();
  if (normalized === '24h' || normalized === '1d') return '24h';
  if (normalized === '7d' || normalized === '7') return '7d';
  if (normalized === '3m' || normalized === '90d' || normalized === '90') return '3m';
  return '28d';
}

export function buildGscDateWindows(now = new Date(), rangeKey: GscRangeKey = '28d'): GscDateWindows {
  const days = RANGE_DAYS[rangeKey] ?? RANGE_DAYS['28d'];
  const end = startOfUtcDay(now);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - (days - 1));

  return {
    current: { startDate: formatGscDate(start), endDate: formatGscDate(end) },
    previous: { startDate: formatGscDate(previousStart), endDate: formatGscDate(previousEnd) },
  };
}

export function parseGscRows(
  rows: GscApiRow[] | undefined,
  dimensions: GscDimension[],
  searchType: GscSearchType
): GscPerformanceRow[] {
  return (rows ?? []).map((row) => {
    const values = row.keys ?? [];
    const dimensionValue = (dimension: GscDimension) => {
      const index = dimensions.indexOf(dimension);
      if (index < 0) return null;
      const value = values[index];
      return typeof value === 'string' && value.length ? value : null;
    };

    return {
      query: dimensionValue('query'),
      page: dimensionValue('page'),
      country: dimensionValue('country'),
      device: dimensionValue('device'),
      searchAppearance: dimensionValue('searchAppearance'),
      date: dimensionValue('date') ?? dimensionValue('hour'),
      searchType,
      clicks: coerceMetric(row.clicks),
      impressions: coerceMetric(row.impressions),
      ctr: coerceMetric(row.ctr),
      position: coerceMetric(row.position),
    };
  });
}

export function summarizeGscPerformance(rows: GscPerformanceRow[]): GscPerformanceSummary {
  const clicks = sum(rows, (row) => row.clicks);
  const impressions = sum(rows, (row) => row.impressions);
  const weightedPosition = impressions
    ? sum(rows, (row) => row.position * row.impressions) / impressions
    : 0;

  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: weightedPosition,
  };
}

export function classifyGscModelFamily(query?: string | null, page?: string | null): GscFamily {
  const haystack = `${query ?? ''} ${page ?? ''}`;
  const direct = FAMILY_PATTERNS.find((entry) => entry.patterns.some((pattern) => pattern.test(haystack)));
  return direct?.family ?? 'Other';
}

export function classifyGscIntent(query?: string | null, page?: string | null): GscIntent {
  const queryText = (query ?? '').toLowerCase();
  const haystack = `${query ?? ''} ${page ?? ''}`.toLowerCase();
  if (/\bmax\s*video\s*ai\b|\bmaxvideoai\b|\bmaxvedio\b|\bmaxvideos?\b/.test(queryText)) return 'brand';
  if (/\bvs\b|\bversus\b|\bcompare\b|\bcomparison\b|\balternative\b|\balternatives\b/.test(haystack)) return 'compare';
  if (/\bpay\s*as\s*you\s*go\b|\bno\s+subscription\b|\bwithout\s+subscription\b|\bsubscription\b/.test(haystack)) return 'pay-as-you-go';
  if (/\bprompts?\b|\bprompt\s+guide\b|\bprompt\s+examples?\b/.test(haystack)) return 'prompt examples';
  if (/\bprice\b|\bpricing\b|\bcost\b|\bcheap\b|\bcredits?\b|\bfree\b/.test(haystack)) return 'pricing';
  if (/\bexamples?\b|\bsamples?\b|\bgallery\b|\/examples(?:\/|$)/.test(haystack)) return 'examples';
  if (/\bspecs?\b|\blimits?\b|\bmax\s+length\b|\bduration\b|\bresolution\b|\bapi\b/.test(haystack)) return 'specs';
  if (/\/tools(?:\/|$)|\btools?\b|\bgenerator\b/.test(haystack)) return 'tool';
  return 'generic';
}

export function findGscOpportunities(rows: GscPerformanceRow[]): GscOpportunity[] {
  const opportunities: GscOpportunity[] = [];

  for (const row of rows) {
    if (row.impressions < 50) continue;
    const family = classifyGscModelFamily(row.query, row.page);
    const intent = classifyGscIntent(row.query, row.page);

    if (row.impressions >= 250 && row.ctr <= 0.012) {
      opportunities.push(buildOpportunity(row, {
        issueType: 'high_impressions_low_ctr',
        priority: row.impressions >= 750 ? 'P1' : 'P2',
        family,
        intent,
        suggestedAction:
          'Improve title/meta and above-the-fold copy so the page mirrors the search phrase more clearly.',
        score: 95 + Math.min(25, row.impressions / 100),
      }));
    }

    if (row.position >= 4 && row.position <= 12 && row.impressions >= 100) {
      opportunities.push(buildOpportunity(row, {
        issueType: 'position_4_to_12',
        priority: row.impressions >= 500 ? 'P1' : 'P2',
        family,
        intent,
        suggestedAction:
          'Strengthen the ranking page with internal links, sharper headings, and a focused content block for this query.',
        score: 70 + Math.min(20, row.impressions / 120) + Math.max(0, 12 - row.position),
      }));
    }

    if (row.position <= 3 && row.clicks === 0 && row.impressions >= 100) {
      opportunities.push(buildOpportunity(row, {
        issueType: 'top_position_zero_clicks',
        priority: row.impressions >= 200 ? 'P1' : 'P2',
        family,
        intent,
        suggestedAction:
          'Audit the SERP intent and rewrite the snippet promise; this ranking should be earning clicks.',
        score: 88 + Math.min(12, row.impressions / 100),
      }));
    }

    if (intent === 'compare' && row.impressions >= 80 && !pageLooksDedicated(row.page, 'compare')) {
      opportunities.push(buildOpportunity(row, {
        issueType: 'dedicated_page_candidate',
        priority: row.impressions >= 300 ? 'P2' : 'P3',
        family,
        intent,
        suggestedAction:
          'Consider a dedicated comparison page or a stronger comparison section on the current ranking page.',
        score: 58 + Math.min(22, row.impressions / 80),
      }));
    }

    if (row.position >= 6 && row.position <= 15 && row.impressions >= 150) {
      opportunities.push(buildOpportunity(row, {
        issueType: 'internal_link_candidate',
        priority: row.impressions >= 500 ? 'P2' : 'P3',
        family,
        intent,
        suggestedAction:
          'Add internal links from the homepage, model hub, examples hub, or related engine pages with exact-match context.',
        score: 55 + Math.min(25, row.impressions / 100),
      }));
    }
  }

  return dedupeOpportunities(opportunities).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.score - a.score);
}

function buildOpportunity(
  row: GscPerformanceRow,
  options: Pick<GscOpportunity, 'issueType' | 'priority' | 'family' | 'intent' | 'suggestedAction' | 'score'>
): GscOpportunity {
  return {
    id: [
      options.issueType,
      row.query ?? 'no-query',
      row.page ?? 'no-page',
      row.country ?? 'all',
      row.device ?? 'all',
    ].join('|'),
    query: row.query,
    page: row.page,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
    ...options,
  };
}

function dedupeOpportunities(opportunities: GscOpportunity[]) {
  const seen = new Set<string>();
  const result: GscOpportunity[] = [];
  for (const opportunity of opportunities) {
    if (seen.has(opportunity.id)) continue;
    seen.add(opportunity.id);
    result.push(opportunity);
  }
  return result;
}

function pageLooksDedicated(page: string | null, intent: 'compare') {
  if (!page) return false;
  if (intent === 'compare') {
    return /\/compare\/|\/ai-video-engines\//i.test(page) && /-vs-|\bvs\b/i.test(page);
  }
  return false;
}

function priorityRank(priority: GscOpportunityPriority) {
  if (priority === 'P1') return 1;
  if (priority === 'P2') return 2;
  return 3;
}

function coerceMetric(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function sum<T>(items: T[], mapper: (item: T) => number) {
  return items.reduce((total, item) => total + mapper(item), 0);
}

function startOfUtcDay(date: Date) {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function formatGscDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
