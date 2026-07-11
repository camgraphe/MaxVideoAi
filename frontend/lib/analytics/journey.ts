import {
  ANALYTICS_JOURNEY_TTL_MS,
  ANALYTICS_JOURNEY_VERSION,
  sanitizeAttributionValue,
  type AnalyticsJourneyRecordV1,
  type AnalyticsTouch,
  type PreparedAnalyticsEvent,
} from './journey-contract';

const DAY_MS = 24 * 60 * 60 * 1000;

const FUNNEL_STAGES: Record<string, string> = {
  sign_up_started: 'signup_started', sign_up_completed: 'signup_completed',
  generation_started: 'generation_started', generation_completed: 'generation_completed', generation_failed: 'generation_failed',
  topup_started: 'topup_started', topup_checkout_opened: 'topup_checkout_opened',
  topup_completed: 'topup_completed', topup_cancelled: 'topup_cancelled', topup_failed: 'topup_failed',
};

const ORGANIC_DOMAINS: ReadonlyArray<{ source: string; domains: readonly string[] }> = [
  {
    source: 'google',
    domains: [
      'google.com', 'google.ca', 'google.co.uk', 'google.com.au', 'google.co.in',
      'google.co.jp', 'google.com.br', 'google.de', 'google.es', 'google.fr',
      'google.it', 'google.nl', 'google.pl', 'google.pt',
    ],
  },
  { source: 'bing', domains: ['bing.com'] },
  { source: 'yahoo', domains: ['yahoo.com', 'yahoo.co.jp', 'yahoo.co.uk'] },
  { source: 'duckduckgo', domains: ['duckduckgo.com'] },
  { source: 'ecosia', domains: ['ecosia.org'] },
  { source: 'baidu', domains: ['baidu.com'] },
  {
    source: 'yandex',
    domains: ['yandex.ru', 'yandex.com', 'yandex.by', 'yandex.kz', 'yandex.uz', 'yandex.com.tr'],
  },
];

type AnalyticsTouchInput = {
  href: string;
  referrer: string;
  siteOrigin: string;
  landingRouteFamily: string;
  landingSurface?: string;
  locale?: string;
};

function normalizeHostname(hostname: string): string | null {
  return sanitizeAttributionValue(hostname.replace(/^www\./i, ''), { lowercase: true });
}

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function routeFields(input: AnalyticsTouchInput): Pick<AnalyticsTouch, 'landingRouteFamily' | 'landingSurface' | 'locale'> {
  return {
    landingRouteFamily: input.landingRouteFamily,
    ...(input.landingSurface ? { landingSurface: input.landingSurface } : {}),
    ...(input.locale ? { locale: input.locale } : {}),
  };
}

export function resolveAnalyticsTouch(input: AnalyticsTouchInput): AnalyticsTouch {
  const pageUrl = safeUrl(input.href);
  const source = pageUrl && sanitizeAttributionValue(pageUrl.searchParams.get('utm_source'), { lowercase: true });
  const medium = pageUrl && sanitizeAttributionValue(pageUrl.searchParams.get('utm_medium'), { lowercase: true });

  if (source && medium) {
    const campaign = sanitizeAttributionValue(pageUrl.searchParams.get('utm_campaign'));
    const content = sanitizeAttributionValue(pageUrl.searchParams.get('utm_content'));
    return {
      source,
      medium,
      ...(campaign ? { campaign } : {}),
      ...(content ? { content } : {}),
      ...routeFields(input),
    };
  }

  const referrerUrl = safeUrl(input.referrer);
  const siteUrl = safeUrl(input.siteOrigin);
  if (
    referrerUrl
    && (referrerUrl.protocol === 'http:' || referrerUrl.protocol === 'https:')
    && (!siteUrl || referrerUrl.origin !== siteUrl.origin)
  ) {
    const referrerHost = normalizeHostname(referrerUrl.hostname);
    if (!referrerHost) return { source: 'direct', medium: 'none', ...routeFields(input) };
    const organic = ORGANIC_DOMAINS.find(({ domains }) => (
      domains.some((domain) => matchesDomain(referrerHost, domain))
    ));
    if (organic) {
      return {
        source: organic.source,
        medium: 'organic',
        referrerHost,
        ...routeFields(input),
      };
    }
    return {
      source: referrerHost,
      medium: 'referral',
      referrerHost,
      ...routeFields(input),
    };
  }

  return { source: 'direct', medium: 'none', ...routeFields(input) };
}

function isoCohortWeek(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function touchFingerprint(touch: AnalyticsTouch): string {
  return [
    touch.source,
    touch.medium,
    touch.campaign ?? '',
    touch.content ?? '',
    touch.referrerHost ?? '',
  ].join('|');
}

export function createAnalyticsJourneyRecord(input: {
  journeyId: string;
  now: number;
  touch: AnalyticsTouch;
}): AnalyticsJourneyRecordV1 {
  return {
    version: ANALYTICS_JOURNEY_VERSION,
    journeyId: input.journeyId,
    createdAt: input.now,
    expiresAt: input.now + ANALYTICS_JOURNEY_TTL_MS,
    cohortWeek: isoCohortWeek(input.now),
    firstTouch: input.touch,
    lastTouch: input.touch,
    lastTouchAt: input.now,
    funnelEntrySent: false,
    generationStartedCount: 0,
    topupStartedCount: 0,
  };
}

export function applyAnalyticsTouch(
  record: AnalyticsJourneyRecordV1,
  touch: AnalyticsTouch,
  now: number,
): AnalyticsJourneyRecordV1 {
  if (
    (touch.source === 'direct' && touch.medium === 'none')
    || touchFingerprint(record.lastTouch) === touchFingerprint(touch)
  ) {
    return record;
  }
  return { ...record, lastTouch: touch, lastTouchAt: now };
}

const JOURNEY_PAYLOAD_KEYS = [
  'journey_id',
  'acquisition_cohort',
  'first_touch_source',
  'first_touch_medium',
  'first_touch_campaign',
  'first_touch_content',
  'last_touch_source',
  'last_touch_medium',
  'last_touch_campaign',
  'last_touch_content',
  'journey_age_days',
  'landing_route_family',
  'landing_surface',
  'journey_locale',
  'funnel_stage',
] as const;

function journeyPayload(record: AnalyticsJourneyRecordV1, now: number): Record<string, unknown> {
  return {
    journey_id: record.journeyId,
    acquisition_cohort: record.cohortWeek,
    first_touch_source: record.firstTouch.source,
    first_touch_medium: record.firstTouch.medium,
    ...(record.firstTouch.campaign ? { first_touch_campaign: record.firstTouch.campaign } : {}),
    ...(record.firstTouch.content ? { first_touch_content: record.firstTouch.content } : {}),
    last_touch_source: record.lastTouch.source,
    last_touch_medium: record.lastTouch.medium,
    ...(record.lastTouch.campaign ? { last_touch_campaign: record.lastTouch.campaign } : {}),
    ...(record.lastTouch.content ? { last_touch_content: record.lastTouch.content } : {}),
    journey_age_days: Math.max(0, Math.floor((now - record.createdAt) / DAY_MS)),
    landing_route_family: record.firstTouch.landingRouteFamily,
    ...(record.firstTouch.landingSurface ? { landing_surface: record.firstTouch.landingSurface } : {}),
    ...(record.firstTouch.locale ? { journey_locale: record.firstTouch.locale } : {}),
  };
}

function mergeJourneyPayload(
  payload: Record<string, unknown>,
  owned: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...payload };
  for (const key of JOURNEY_PAYLOAD_KEYS) delete merged[key];
  return { ...merged, ...owned };
}

export function prepareJourneyEvents(
  record: AnalyticsJourneyRecordV1,
  event: string,
  payload: Record<string, unknown> = {},
  now = Date.now(),
): { record: AnalyticsJourneyRecordV1; events: PreparedAnalyticsEvent[] } {
  let nextRecord = record;
  const eventFields: Record<string, unknown> = {};

  if (event === 'generation_started') {
    const generationSequence = record.generationStartedCount + 1;
    nextRecord = { ...nextRecord, generationStartedCount: generationSequence };
    eventFields.generation_sequence = generationSequence;
    eventFields.is_first_generation = generationSequence === 1;
  } else if (event === 'topup_started') {
    const topupSequence = record.topupStartedCount + 1;
    nextRecord = { ...nextRecord, topupStartedCount: topupSequence };
    eventFields.topup_sequence = topupSequence;
    eventFields.is_first_topup_attempt = topupSequence === 1;
  }

  const common = journeyPayload(nextRecord, now);
  const events: PreparedAnalyticsEvent[] = [];
  if (!nextRecord.funnelEntrySent) {
    nextRecord = { ...nextRecord, funnelEntrySent: true };
    events.push({
      event: 'funnel_entry',
      payload: { ...common, funnel_stage: 'entry' },
    });
  }

  const funnelStage = FUNNEL_STAGES[event];
  events.push({
    event,
    payload: mergeJourneyPayload(payload, {
      ...eventFields,
      ...common,
      ...(funnelStage ? { funnel_stage: funnelStage } : {}),
    }),
  });

  return { record: nextRecord, events };
}
