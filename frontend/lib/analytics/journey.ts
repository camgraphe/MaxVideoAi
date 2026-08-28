import {
  ANALYTICS_JOURNEY_TTL_MS,
  ANALYTICS_JOURNEY_VERSION,
  sanitizeAttributionFieldValue,
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

type ApprovedUtmTouch = {
  source: string;
  medium: string;
  campaign?: string;
  contents?: readonly string[];
};

const APPROVED_UTM_TOUCHES: readonly ApprovedUtmTouch[] = [
  { source: 'google', medium: 'cpc' },
  { source: 'google', medium: 'cpc', campaign: 'Launch', contents: ['Hero'] },
  { source: 'newsletter', medium: 'email' },
  {
    source: 'github', medium: 'repository', campaign: 'maxvideoai_product',
    contents: ['hero_try', 'models', 'plugin_callout'],
  },
  {
    source: 'github', medium: 'repository', campaign: 'assistant_video_plugin',
    contents: ['hero_connect', 'pricing', 'library'],
  },
  {
    source: 'github', medium: 'release', campaign: 'assistant_video_plugin_0_3_0',
    contents: ['release_connect', 'release_docs'],
  },
  {
    source: 'github', medium: 'example', campaign: 'assistant_video_workflows',
    contents: [
      'compare_ai_video_models',
      'price_a_video_project',
      'claude_video_production',
      'codex_video_production',
    ],
  },
  {
    source: 'linkedin', medium: 'social', campaign: 'seedance_2_5_launch',
    contents: ['announcement', 'city', 'train'],
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
  const normalized = hostname.normalize('NFKC').trim().toLowerCase().replace(/^www\./, '');
  return normalized || null;
}

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function matchesGoogleDomain(hostname: string): boolean {
  if (matchesDomain(hostname, 'google.com') || matchesDomain(hostname, 'google.cat')) return true;
  return /(?:^|\.)google\.(?:[a-z]{2}|(?:co|com)\.[a-z]{2})$/.test(hostname);
}

function organicSourceForHostname(hostname: string): string | null {
  if (matchesGoogleDomain(hostname)) return 'google';
  return ORGANIC_DOMAINS.find(({ domains }) => (
    domains.some((domain) => matchesDomain(hostname, domain))
  ))?.source ?? null;
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
  const source = pageUrl && sanitizeAttributionFieldValue(pageUrl.searchParams.get('utm_source'), { lowercase: true });
  const medium = pageUrl && sanitizeAttributionFieldValue(pageUrl.searchParams.get('utm_medium'), { lowercase: true });

  if (source && medium) {
    const campaign = sanitizeAttributionFieldValue(pageUrl.searchParams.get('utm_campaign'));
    const content = sanitizeAttributionFieldValue(pageUrl.searchParams.get('utm_content'));
    const approved = APPROVED_UTM_TOUCHES.some((touch) => (
      touch.source === source
      && touch.medium === medium
      && touch.campaign === (campaign ?? undefined)
      && (touch.contents ? Boolean(content && touch.contents.includes(content)) : !content)
    ));
    if (approved) {
      return {
        source,
        medium,
        ...(campaign ? { campaign } : {}),
        ...(content ? { content } : {}),
        ...routeFields(input),
      };
    }
  }

  const referrerUrl = safeUrl(input.referrer);
  const siteUrl = safeUrl(input.siteOrigin);
  if (
    referrerUrl
    && (referrerUrl.protocol === 'http:' || referrerUrl.protocol === 'https:')
    && (!siteUrl || referrerUrl.origin !== siteUrl.origin)
  ) {
    const classificationHost = normalizeHostname(referrerUrl.hostname);
    if (!classificationHost) return { source: 'direct', medium: 'none', ...routeFields(input) };
    const referrerHost = sanitizeAttributionValue(classificationHost, { lowercase: true });
    if (!referrerHost) return { source: 'direct', medium: 'none', ...routeFields(input) };
    const organicSource = organicSourceForHostname(classificationHost);
    if (organicSource) {
      return {
        source: organicSource,
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

const CLICK_PAYLOAD_KEYS = [
  'route_family', 'cta_name', 'cta_location', 'target_family', 'tool_name', 'tool_surface',
] as const;
const AUTH_PAYLOAD_KEYS = [
  'route_family', 'auth_surface', 'method', 'marketing_opt_in', 'email_confirmation_required',
] as const;
const TOOL_PAYLOAD_KEYS = [
  'route_family', 'tool_name', 'tool_surface', 'logged_in', 'action', 'source_mode', 'output_mode',
  'quality_mode', 'format_mode', 'generate_count', 'engine', 'generate_best_angles', 'rotation', 'tilt', 'zoom',
] as const;
const GENERATION_CONTEXT_PAYLOAD_KEYS = [
  'route_family', 'local_key', 'job_id', 'batch_id', 'group_id', 'iteration_index', 'iteration_count',
  'batch_size', 'engine', 'mode', 'duration_sec', 'payment_mode', 'has_audio', 'price_cents', 'amount',
  'currency', 'route', 'payment_status', 'generation_sequence', 'is_first_generation',
] as const;
const TOPUP_PAYLOAD_KEYS = [
  'route_family', 'payment_provider', 'payment_flow', 'charge_currency', 'wallet_amount_usd',
  'wallet_amount_cents', 'credits_amount', 'topup_amount_usd', 'topup_amount_cents', 'topup_tier_id',
  'topup_tier_label', 'settlement_currency', 'settlement_amount_minor', 'value', 'currency', 'failure_category',
] as const;

const ANALYTICS_EVENT_PAYLOAD_KEYS = {
  page_view: [
    'route_family', 'page_location', 'page_path', 'page_title', 'tool_name', 'tool_surface', 'workspace_section',
  ],
  tool_view: ['route_family', 'tool_name', 'tool_surface', 'logged_in'],
  app_open: ['route_family', 'app_section'],
  tool_cta_click: CLICK_PAYLOAD_KEYS,
  cta_click: CLICK_PAYLOAD_KEYS,
  hero_start_render_click: CLICK_PAYLOAD_KEYS,
  hero_examples_click: CLICK_PAYLOAD_KEYS,
  hero_compare_click: CLICK_PAYLOAD_KEYS,
  model_card_click: CLICK_PAYLOAD_KEYS,
  example_category_click: CLICK_PAYLOAD_KEYS,
  comparison_card_click: CLICK_PAYLOAD_KEYS,
  mcp_internal_link_click: CLICK_PAYLOAD_KEYS,
  shot_type_card_click: CLICK_PAYLOAD_KEYS,
  tool_card_click: CLICK_PAYLOAD_KEYS,
  pricing_cta_click: CLICK_PAYLOAD_KEYS,
  mcp_landing_cta_clicked: ['route_family', 'action', 'client', 'destination', 'locale'],
  mcp_endpoint_copy_clicked: ['route_family', 'action', 'client', 'destination', 'locale'],
  sign_up_started: AUTH_PAYLOAD_KEYS,
  sign_up_completed: AUTH_PAYLOAD_KEYS,
  login_completed: AUTH_PAYLOAD_KEYS,
  tool_start: TOOL_PAYLOAD_KEYS,
  tool_complete: [
    ...TOOL_PAYLOAD_KEYS,
    'result_count', 'latency_ms', 'estimated_cost_usd', 'actual_cost_usd', 'estimated_credits',
    'actual_credits', 'output_count',
  ],
  group_render_initiated: ['route_family', 'batchid', 'iterations', 'engine', 'total_cents', 'currency'],
  generation_started: GENERATION_CONTEXT_PAYLOAD_KEYS,
  generation_completed: [
    ...GENERATION_CONTEXT_PAYLOAD_KEYS, 'final_price_cents', 'render_count',
  ],
  generation_failed: [...GENERATION_CONTEXT_PAYLOAD_KEYS, 'error_code', 'failure_category'],
  topup_started: TOPUP_PAYLOAD_KEYS,
  topup_checkout_opened: TOPUP_PAYLOAD_KEYS,
  topup_completed: TOPUP_PAYLOAD_KEYS,
  topup_cancelled: TOPUP_PAYLOAD_KEYS,
  topup_failed: TOPUP_PAYLOAD_KEYS,
  tile_action: ['route_family', 'action', 'batchid', 'version'],
  compare_used: ['route_family', 'batchid'],
} as const satisfies Record<string, readonly string[]>;

export type AllowedAnalyticsEvent = keyof typeof ANALYTICS_EVENT_PAYLOAD_KEYS;

export function isAllowedAnalyticsEvent(event: string): event is AllowedAnalyticsEvent {
  return Object.hasOwn(ANALYTICS_EVENT_PAYLOAD_KEYS, event);
}

const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const MAX_PERCENT_DECODE_PASSES = 3;
const CONTROL_OR_BACKSLASH_PATTERN = /[\u0000-\u001F\u007F-\u009F\\]/;

function decodePercentEncoded(value: string): string | null {
  let decoded = value;
  for (let pass = 0; pass < MAX_PERCENT_DECODE_PASSES; pass += 1) {
    if (CONTROL_OR_BACKSLASH_PATTERN.test(decoded)) return null;
    if (!decoded.includes('%')) return decoded;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return null;
      decoded = next;
    } catch {
      return null;
    }
  }
  return decoded.includes('%') || CONTROL_OR_BACKSLASH_PATTERN.test(decoded) ? null : decoded;
}

function normalizedAnalyticsPayloadKey(key: string): string | null {
  const decoded = decodePercentEncoded(key);
  if (decoded === null) return null;
  const normalized = decoded.normalize('NFKC').toLowerCase();
  const gaKey = normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return gaKey && gaKey.length <= 40 ? gaKey : null;
}

function analyticsPrimitive(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'string') {
    if (value.length > 360) return undefined;
    const decoded = decodePercentEncoded(value.normalize('NFKC'));
    if (decoded === null) return undefined;
    const normalized = decoded.normalize('NFKC').trim();
    if (CONTROL_OR_BACKSLASH_PATTERN.test(normalized)) return undefined;
    const isSafeInternalPath = normalized.startsWith('/')
      && !normalized.startsWith('//')
      && !normalized.includes('?')
      && !normalized.includes('#')
      && !normalized.includes('\\');
    if (
      !normalized
      || normalized.length > 120
      || URL_SCHEME_PATTERN.test(normalized)
      || normalized.startsWith('//')
      || (normalized.startsWith('/') && !isSafeInternalPath)
      || normalized.includes('?')
      || normalized.includes('#')
    ) {
      return undefined;
    }
    return normalized;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  return typeof value === 'boolean' ? value : undefined;
}

function projectAnalyticsPayload(
  event: AllowedAnalyticsEvent,
  payload: Record<string, unknown>,
): Record<string, string | number | boolean> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const projected: Record<string, string | number | boolean> = {};
  const allowedKeys = new Set<string>(ANALYTICS_EVENT_PAYLOAD_KEYS[event]);
  try {
    for (const key of Object.keys(payload)) {
      const normalizedKey = normalizedAnalyticsPayloadKey(key);
      const descriptor = Object.getOwnPropertyDescriptor(payload, key);
      if (!normalizedKey || !allowedKeys.has(normalizedKey) || !descriptor || !Object.hasOwn(descriptor, 'value')) continue;
      const value = analyticsPrimitive(descriptor.value);
      if (value !== undefined) projected[normalizedKey] = value;
    }
  } catch {
    return {};
  }
  return projected;
}

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
  event: AllowedAnalyticsEvent,
  payload: Record<string, unknown>,
  owned: Record<string, unknown>,
): Record<string, unknown> {
  const merged = projectAnalyticsPayload(event, payload);
  for (const key of JOURNEY_PAYLOAD_KEYS) delete merged[key];
  return { ...merged, ...owned };
}

export function prepareJourneyEvents(
  record: AnalyticsJourneyRecordV1,
  event: string,
  payload: Record<string, unknown> = {},
  now = Date.now(),
): { record: AnalyticsJourneyRecordV1; events: PreparedAnalyticsEvent[] } {
  if (!isAllowedAnalyticsEvent(event)) return { record, events: [] };

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
    payload: mergeJourneyPayload(event, payload, {
      ...eventFields,
      ...common,
      ...(funnelStage ? { funnel_stage: funnelStage } : {}),
    }),
  });

  return { record: nextRecord, events };
}
