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
    source: 'github', medium: 'release', campaign: 'assistant_video_plugin_0_3_2',
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

const ANALYTICS_ROUTE_FAMILIES = new Set([
  'admin', 'auth', 'marketing', 'public_tools', 'app_tools', 'workspace', 'billing',
]);
const ANALYTICS_LOCALES = new Set(['en', 'fr', 'es']);
const ANALYTICS_TOOL_NAMES = new Set([
  'tools_hub', 'angle', 'background_removal', 'character_builder', 'storyboard', 'upscale', 'audio',
]);
const ANALYTICS_WORKSPACE_SECTIONS = new Set([
  'home', 'image', 'audio', 'library', 'tools', 'billing', 'generate', 'dashboard', 'jobs',
  'settings', 'connect', 'video',
]);
const SAFE_MARKETING_LANDING_SURFACES = new Set([
  '/', '/about', '/ai-video-engines', '/benchmarks', '/best-for', '/blog', '/changelog',
  '/company', '/compare', '/contact', '/docs', '/editorial-standards', '/examples',
  '/integrations/chatgpt', '/integrations/claude', '/integrations/codex', '/legal',
  '/legal/acceptable-use', '/legal/cookies', '/legal/cookies-list', '/legal/mentions',
  '/legal/privacy', '/legal/subprocessors', '/legal/takedown', '/legal/terms', '/mcp',
  '/models', '/pay-as-you-go-ai-video-generator', '/pricing', '/status', '/tools', '/workflows',
]);
const MARKETING_OWNER_SURFACES: Readonly<Record<string, string>> = {
  '/ai-video-engines/': '/ai-video-engines',
  '/blog/': '/blog',
  '/docs/': '/docs',
  '/examples/': '/examples',
  '/modeles/': '/models',
  '/modelos/': '/models',
  '/models/': '/models',
};
const ORGANIC_SOURCES = new Set(['google', 'bing', 'yahoo', 'duckduckgo', 'ecosia', 'baidu', 'yandex']);
const UNWANTED_REFERRER_DOMAINS = ['stripe.com', 'accounts.google.com'] as const;
const ANALYTICS_TOUCH_KEYS = new Set([
  'source', 'medium', 'campaign', 'content', 'referrerHost', 'landingRouteFamily',
  'landingSurface', 'locale',
]);

function safeMarketingLandingSurface(value: string): string | undefined {
  if (SAFE_MARKETING_LANDING_SURFACES.has(value)) return value;
  for (const [prefix, owner] of Object.entries(MARKETING_OWNER_SURFACES)) {
    if (value.startsWith(prefix)) return owner;
  }
  return undefined;
}

export function projectAnalyticsLandingSurface(
  routeFamily: string,
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = analyticsPrimitive(value);
  if (typeof normalized !== 'string') return undefined;
  if (routeFamily === 'marketing') return safeMarketingLandingSurface(normalized);
  if (routeFamily === 'public_tools' || routeFamily === 'app_tools') {
    return ANALYTICS_TOOL_NAMES.has(normalized) ? normalized : undefined;
  }
  if (routeFamily === 'workspace') {
    return ANALYTICS_WORKSPACE_SECTIONS.has(normalized) ? normalized : undefined;
  }
  if (routeFamily === 'auth' || routeFamily === 'billing' || routeFamily === 'admin') {
    return normalized === routeFamily ? normalized : undefined;
  }
  return undefined;
}

function isApprovedUtmTouch(input: {
  source: string;
  medium: string;
  campaign?: string;
  content?: string;
}): boolean {
  return APPROVED_UTM_TOUCHES.some((touch) => (
    touch.source === input.source
    && touch.medium === input.medium
    && touch.campaign === input.campaign
    && (touch.contents ? Boolean(input.content && touch.contents.includes(input.content)) : !input.content)
  ));
}

function isSafeHostname(value: string): boolean {
  return value.length <= 80
    && value.includes('.')
    && !value.includes('..')
    && /^(?:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?))*$/i.test(value);
}

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
  const landingRouteFamily = ANALYTICS_ROUTE_FAMILIES.has(input.landingRouteFamily)
    ? input.landingRouteFamily
    : 'marketing';
  const landingSurface = projectAnalyticsLandingSurface(landingRouteFamily, input.landingSurface);
  const locale = typeof input.locale === 'string' && ANALYTICS_LOCALES.has(input.locale)
    ? input.locale
    : undefined;
  return {
    landingRouteFamily,
    ...(landingSurface ? { landingSurface } : {}),
    ...(locale ? { locale } : {}),
  };
}

export function projectAnalyticsTouch(value: unknown): AnalyticsTouch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const touch = value as Record<string, unknown>;
  let keys: string[];
  try {
    keys = Object.keys(touch);
  } catch {
    return null;
  }
  if (keys.some((key) => !ANALYTICS_TOUCH_KEYS.has(key))) return null;

  const ownValue = (key: string): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(touch, key);
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
  };
  if (!Object.hasOwn(touch, 'source') || !Object.hasOwn(touch, 'medium') || !Object.hasOwn(touch, 'landingRouteFamily')) {
    return null;
  }

  const sourceInput = ownValue('source');
  const mediumInput = ownValue('medium');
  const campaignInput = ownValue('campaign');
  const contentInput = ownValue('content');
  const referrerHostInput = ownValue('referrerHost');
  const routeFamilyInput = ownValue('landingRouteFamily');
  const landingSurfaceInput = ownValue('landingSurface');
  const localeInput = ownValue('locale');
  const source = sanitizeAttributionFieldValue(sourceInput, { lowercase: true });
  const medium = sanitizeAttributionFieldValue(mediumInput, { lowercase: true });
  const campaign = campaignInput === undefined
    ? undefined
    : sanitizeAttributionFieldValue(campaignInput) ?? undefined;
  const content = contentInput === undefined
    ? undefined
    : sanitizeAttributionFieldValue(contentInput) ?? undefined;
  const referrerHost = referrerHostInput === undefined
    ? undefined
    : sanitizeAttributionValue(referrerHostInput, { lowercase: true }) ?? undefined;
  const landingRouteFamily = typeof routeFamilyInput === 'string'
    && ANALYTICS_ROUTE_FAMILIES.has(routeFamilyInput)
    ? routeFamilyInput
    : null;
  const landingSurface = landingRouteFamily
    ? projectAnalyticsLandingSurface(landingRouteFamily, landingSurfaceInput)
    : undefined;
  const locale = localeInput === undefined
    ? undefined
    : typeof localeInput === 'string' && ANALYTICS_LOCALES.has(localeInput)
      ? localeInput
      : undefined;

  if (
    !source
    || !medium
    || !landingRouteFamily
    || (Object.hasOwn(touch, 'campaign') && !campaign)
    || (Object.hasOwn(touch, 'content') && !content)
    || (Object.hasOwn(touch, 'referrerHost') && !referrerHost)
    || (Object.hasOwn(touch, 'landingSurface') && !landingSurface)
    || (Object.hasOwn(touch, 'locale') && !locale)
  ) {
    return null;
  }

  const isDirect = source === 'direct' && medium === 'none'
    && campaign === undefined && content === undefined && referrerHost === undefined;
  const isApprovedCampaign = referrerHost === undefined && isApprovedUtmTouch({
    source, medium, ...(campaign ? { campaign } : {}), ...(content ? { content } : {}),
  });
  const isOrganic = medium === 'organic' && ORGANIC_SOURCES.has(source)
    && Boolean(referrerHost && isSafeHostname(referrerHost));
  const isReferral = medium === 'referral' && Boolean(
    referrerHost && source === referrerHost && isSafeHostname(referrerHost),
  );
  if (!isDirect && !isApprovedCampaign && !isOrganic && !isReferral) return null;

  return {
    source,
    medium,
    ...(campaign ? { campaign } : {}),
    ...(content ? { content } : {}),
    ...(referrerHost ? { referrerHost } : {}),
    landingRouteFamily,
    ...(landingSurface ? { landingSurface } : {}),
    ...(locale ? { locale } : {}),
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
    if (UNWANTED_REFERRER_DOMAINS.some((domain) => matchesDomain(classificationHost, domain))) {
      return { source: 'direct', medium: 'none', ...routeFields(input) };
    }
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
  const touch = projectAnalyticsTouch(input.touch) ?? {
    source: 'direct',
    medium: 'none',
    landingRouteFamily: 'marketing',
  };
  return {
    version: ANALYTICS_JOURNEY_VERSION,
    journeyId: input.journeyId,
    createdAt: input.now,
    expiresAt: input.now + ANALYTICS_JOURNEY_TTL_MS,
    cohortWeek: isoCohortWeek(input.now),
    firstTouch: touch,
    lastTouch: touch,
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
  const projectedTouch = projectAnalyticsTouch(touch);
  if (!projectedTouch) return record;
  if (
    (projectedTouch.source === 'direct' && projectedTouch.medium === 'none')
    || touchFingerprint(record.lastTouch) === touchFingerprint(projectedTouch)
  ) {
    return record;
  }
  return { ...record, lastTouch: projectedTouch, lastTouchAt: now };
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

type AnalyticsPrimitive = string | number | boolean;

const ENGINE_IDS = new Set([
  'happy-horse-1-0', 'happy-horse-1-1', 'seedance-2-0-mini', 'seedance-1-5-pro',
  'seedance-2-0', 'seedance-2-0-fast', 'seedance-2-5', 'seedream', 'seedream-5-0-pro',
  'nano-banana', 'nano-banana-2', 'nano-banana-lite', 'nano-banana-pro', 'gemini-omni-flash',
  'veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite', 'kling-2-5-turbo', 'kling-2-6-pro',
  'kling-3-4k', 'kling-3-pro', 'kling-3-standard', 'kling-o3-4k', 'kling-o3-pro',
  'kling-o3-standard', 'ltx-2-3-fast', 'ltx-2-3', 'ltx-2-fast', 'ltx-2', 'lumaRay2',
  'lumaRay2_flash', 'luma-ray-3-2', 'luma-uni-1', 'luma-uni-1-max', 'minimax-h3',
  'minimax-hailuo-02-text', 'gpt-image-2', 'sora-2', 'sora-2-pro', 'pika-text-to-video',
  'wan-2-5', 'wan-2-6', 'flux-multiple-angles', 'qwen-multiple-angles', 'seedvr-image',
  'topaz-image', 'recraft-crisp', 'seedvr-video', 'flashvsr-video', 'topaz-video',
  'bria-video-background-removal-v3',
]);
const CTA_NAMES = new Set([
  'marketing_nav_login', 'marketing_nav_start_app', 'homepage_ai_video_plugin', 'all_comparisons',
  'all_examples', 'all_models', 'browse_tools', 'open_workspace', 'view_pricing', 'compare_engines',
  'see_examples', 'start_render', 'best-for-hub', 'angle_hub_hero_secondary',
  'character_builder_hub_hero_primary', 'angle_try_tool_final', 'angle_try_tool_hero',
  'angle_try_tool_examples', 'character_builder_try_tool_final', 'character_builder_try_tool_hero',
  ...ENGINE_IDS,
]);
const CTA_LOCATIONS = new Set([
  'marketing_nav_mobile', 'marketing_nav_desktop', 'home_assistant_workflow', 'comparison_intro',
  'comparison_preview', 'reference_workflow', 'toolbox', 'toolbox_cta', 'transparent_pricing',
  'home_hero', 'examples_preview', 'examples_preview_cta', 'examples_preview_featured_model',
  'examples_preview_header', 'examples_preview_model', 'shot_type_hub_cta', 'shot_type_selector',
  'tools_hub_hero', 'tool_angle_final', 'tool_angle_hero', 'tool_angle_examples',
  'tool_character_builder_final', 'tool_character_builder_hero',
]);
const EXACT_STRING_VALUES: Readonly<Record<string, ReadonlySet<string>>> = {
  route_family: ANALYTICS_ROUTE_FAMILIES,
  tool_name: ANALYTICS_TOOL_NAMES,
  tool_surface: new Set(['public', 'workspace']),
  workspace_section: ANALYTICS_WORKSPACE_SECTIONS,
  app_section: new Set(['workspace', ...ANALYTICS_WORKSPACE_SECTIONS]),
  cta_name: CTA_NAMES,
  cta_location: CTA_LOCATIONS,
  target_family: new Set(['auth', 'workspace', 'examples', 'compare', 'models', 'tools', 'pricing', 'mcp', 'best-for', 'public_tools', 'app_tools']),
  action: new Set(['connect', 'copy_endpoint', 'generate', 'full_body_fix', 'lighting_variant', 'continue', 'refine', 'branch', 'copy', 'open']),
  client: new Set(['claude', 'chatgpt', 'codex']),
  destination: new Set(['verified_deep_link', 'setup_guide', 'manual_setup']),
  locale: ANALYTICS_LOCALES,
  auth_surface: new Set(['login']),
  method: new Set(['password', 'google']),
  source_mode: new Set(['scratch', 'reference-image']),
  output_mode: new Set(['portrait_reference', 'character_sheet']),
  quality_mode: new Set(['draft', 'final']),
  format_mode: new Set(['standard', '2k', '4k']),
  engine: ENGINE_IDS,
  mode: new Set(['t2v', 'i2v', 'ref2v', 'v2v', 'r2v', 'fl2v', 'a2v', 't2i', 'i2i', 'extend', 'retake', 'reframe']),
  payment_mode: new Set(['wallet', 'platform']),
  payment_status: new Set(['pending_payment', 'paid_wallet', 'paid_direct', 'refunded_wallet', 'included_mcp_trial', 'platform', 'quoted', 'curated', 'completed']),
  payment_provider: new Set(['stripe']),
  payment_flow: new Set(['checkout']),
  topup_tier_id: new Set(['usd_10', 'usd_25', 'usd_50', 'usd_100', 'custom']),
  topup_tier_label: new Set(['$10', '$25', '$50', '$100', 'Custom']),
  failure_category: new Set(['authentication', 'validation', 'network', 'stripe', 'unknown', 'generation_request_failed', 'job_failed']),
  error_code: new Set(['generation_request_failed', 'INSUFFICIENT_WALLET_FUNDS', 'INSUFFICIENT_FUNDS', 'auth_required', 'UNAUTHORIZED']),
};

const BOOLEAN_FIELDS = new Set([
  'logged_in', 'marketing_opt_in', 'email_confirmation_required', 'generate_best_angles', 'has_audio',
  'is_first_generation',
]);
const INTEGER_FIELDS: Readonly<Record<string, readonly [number, number]>> = {
  generate_count: [0, 100],
  result_count: [0, 100],
  output_count: [0, 100],
  iterations: [0, 100],
  iteration_index: [0, 100],
  iteration_count: [0, 100],
  batch_size: [0, 100],
  generation_sequence: [0, 1_000_000],
  render_count: [0, 100],
  version: [0, 10_000],
  duration_sec: [0, 86_400],
  latency_ms: [0, 86_400_000],
  price_cents: [0, 1_000_000_000],
  final_price_cents: [0, 1_000_000_000],
  total_cents: [0, 1_000_000_000],
  wallet_amount_cents: [0, 1_000_000_000],
  topup_amount_cents: [0, 1_000_000_000],
  settlement_amount_minor: [0, 1_000_000_000],
};
const DECIMAL_FIELDS: Readonly<Record<string, readonly [number, number]>> = {
  amount: [0, 10_000_000],
  estimated_cost_usd: [0, 10_000_000],
  actual_cost_usd: [0, 10_000_000],
  estimated_credits: [0, 10_000_000],
  actual_credits: [0, 10_000_000],
  wallet_amount_usd: [0, 10_000_000],
  credits_amount: [0, 10_000_000],
  topup_amount_usd: [0, 10_000_000],
  settlement_amount_minor: [0, 1_000_000_000],
  value: [0, 10_000_000],
  rotation: [-360, 360],
  tilt: [-90, 90],
  zoom: [0, 100],
};
const CURRENCY_FIELDS = new Set(['currency', 'charge_currency', 'settlement_currency']);
const CURRENCY_CODES = new Set(['USD', 'EUR', 'GBP', 'CHF']);
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const JOB_ID_PATTERN = new RegExp(`^(?:job|aud|img|tool_(?:angle|background_removal|upscale))_${UUID}$`, 'i');
const BATCH_ID_PATTERN = /^batch_[a-z0-9]{4,20}_[a-z0-9]{4,16}$/;
const LOCAL_KEY_PATTERN = /^local_batch_[a-z0-9]{4,20}_[a-z0-9]{4,16}_[1-9][0-9]{0,2}$/;
const SAFE_STATIC_PATHS = new Set([
  '/', '/mcp', '/models', '/examples', '/compare', '/pricing', '/best-for', '/tools', '/app',
  '/app/image', '/app/audio', '/app/library', '/app/tools', '/billing', '/login', '/signup',
  '/dashboard', '/generate', '/jobs', '/settings', '/connect', '/video/:video',
]);

function validateSafeAnalyticsPath(value: AnalyticsPrimitive): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (SAFE_STATIC_PATHS.has(value)) return value;
  const segments = value.split('/').filter(Boolean);
  if (segments.length === 2 && ['models', 'modeles', 'modelos'].includes(segments[0] ?? '') && ENGINE_IDS.has(segments[1] ?? '')) return value;
  if (segments.length === 2 && ['integrations', 'integraciones'].includes(segments[0] ?? '') && ['claude', 'chatgpt', 'codex'].includes(segments[1] ?? '')) return value;
  if (segments.length === 2 && segments[0] === 'tools' && ANALYTICS_TOOL_NAMES.has((segments[1] ?? '').replace(/-/g, '_'))) return value;
  if (segments.length === 3 && segments[0] === 'app' && segments[1] === 'tools' && ANALYTICS_TOOL_NAMES.has((segments[2] ?? '').replace(/-/g, '_'))) return value;
  return undefined;
}

function validateAnalyticsFieldValue(key: string, input: unknown): AnalyticsPrimitive | undefined {
  const value = analyticsPrimitive(input);
  if (value === undefined) return undefined;

  const exactValues = EXACT_STRING_VALUES[key];
  if (exactValues) return typeof value === 'string' && exactValues.has(value) ? value : undefined;
  if (BOOLEAN_FIELDS.has(key)) return typeof value === 'boolean' ? value : undefined;
  if (CURRENCY_FIELDS.has(key)) return typeof value === 'string' && CURRENCY_CODES.has(value) ? value : undefined;
  if (key === 'page_path' || key === 'route') return validateSafeAnalyticsPath(value);
  if (key === 'local_key') return typeof value === 'string' && LOCAL_KEY_PATTERN.test(value) ? value : undefined;
  if (key === 'job_id') return typeof value === 'string' && JOB_ID_PATTERN.test(value) ? value : undefined;
  if (key === 'batch_id' || key === 'group_id' || key === 'batchid') {
    return typeof value === 'string' && BATCH_ID_PATTERN.test(value) ? value : undefined;
  }

  const integerRange = INTEGER_FIELDS[key];
  if (integerRange) {
    return typeof value === 'number' && Number.isInteger(value) && value >= integerRange[0] && value <= integerRange[1]
      ? value
      : undefined;
  }
  const decimalRange = DECIMAL_FIELDS[key];
  if (decimalRange) {
    return typeof value === 'number' && value >= decimalRange[0] && value <= decimalRange[1] ? value : undefined;
  }
  return undefined;
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
      const value = validateAnalyticsFieldValue(normalizedKey, descriptor.value);
      if (value !== undefined) projected[normalizedKey] = value;
    }
  } catch {
    return {};
  }
  return projected;
}

export function projectAllowedAnalyticsPayload(
  event: string,
  payload: Record<string, unknown> = {},
): Record<string, string | number | boolean> | null {
  return isAllowedAnalyticsEvent(event) ? projectAnalyticsPayload(event, payload) : null;
}

const FUNNEL_STAGE_VALUES = new Set(['entry', ...Object.values(FUNNEL_STAGES)]);
const JOURNEY_SEQUENCE_FIELDS = new Set(['generation_sequence', 'topup_sequence']);
const JOURNEY_BOOLEAN_FIELDS = new Set(['is_first_generation', 'is_first_topup_attempt']);

function projectJourneyOwnedPayload(
  payload: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const projected: Record<string, string | number | boolean> = {};
  const routeFamily = typeof payload.landing_route_family === 'string'
    && ANALYTICS_ROUTE_FAMILIES.has(payload.landing_route_family)
    ? payload.landing_route_family
    : undefined;

  for (const [key, input] of Object.entries(payload)) {
    if (key === 'journey_id' && typeof input === 'string' && new RegExp(`^${UUID}$`, 'i').test(input)) {
      projected[key] = input;
    } else if (key === 'acquisition_cohort' && typeof input === 'string' && /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(input)) {
      projected[key] = input;
    } else if (key === 'journey_age_days' && typeof input === 'number' && Number.isInteger(input) && input >= 0 && input <= 90) {
      projected[key] = input;
    } else if (key === 'landing_route_family' && routeFamily) {
      projected[key] = routeFamily;
    } else if (key === 'landing_surface' && routeFamily) {
      const surface = projectAnalyticsLandingSurface(routeFamily, input);
      if (surface) projected[key] = surface;
    } else if (key === 'journey_locale' && typeof input === 'string' && ANALYTICS_LOCALES.has(input)) {
      projected[key] = input;
    } else if (key === 'funnel_stage' && typeof input === 'string' && FUNNEL_STAGE_VALUES.has(input)) {
      projected[key] = input;
    } else if (JOURNEY_SEQUENCE_FIELDS.has(key) && typeof input === 'number' && Number.isInteger(input) && input >= 1 && input <= 1_000_000) {
      projected[key] = input;
    } else if (JOURNEY_BOOLEAN_FIELDS.has(key) && typeof input === 'boolean') {
      projected[key] = input;
    } else if (/^(?:first|last)_touch_(?:source|medium|campaign|content)$/.test(key)) {
      const value = sanitizeAttributionFieldValue(input, {
        lowercase: key.endsWith('_source') || key.endsWith('_medium'),
      });
      if (value) projected[key] = value;
    }
  }
  return projected;
}

function journeyPayload(
  record: AnalyticsJourneyRecordV1,
  now: number,
): Record<string, string | number | boolean> {
  const firstTouch = projectAnalyticsTouch(record.firstTouch);
  const lastTouch = projectAnalyticsTouch(record.lastTouch);
  return projectJourneyOwnedPayload({
    journey_id: record.journeyId,
    acquisition_cohort: record.cohortWeek,
    ...(firstTouch ? {
      first_touch_source: firstTouch.source,
      first_touch_medium: firstTouch.medium,
      ...(firstTouch.campaign ? { first_touch_campaign: firstTouch.campaign } : {}),
      ...(firstTouch.content ? { first_touch_content: firstTouch.content } : {}),
      landing_route_family: firstTouch.landingRouteFamily,
      ...(firstTouch.landingSurface ? { landing_surface: firstTouch.landingSurface } : {}),
      ...(firstTouch.locale ? { journey_locale: firstTouch.locale } : {}),
    } : {}),
    ...(lastTouch ? {
      last_touch_source: lastTouch.source,
      last_touch_medium: lastTouch.medium,
      ...(lastTouch.campaign ? { last_touch_campaign: lastTouch.campaign } : {}),
      ...(lastTouch.content ? { last_touch_content: lastTouch.content } : {}),
    } : {}),
    journey_age_days: Math.max(0, Math.floor((now - record.createdAt) / DAY_MS)),
  });
}

function mergeJourneyPayload(
  event: AllowedAnalyticsEvent,
  payload: Record<string, unknown>,
  owned: Record<string, unknown>,
): Record<string, unknown> {
  const merged = projectAnalyticsPayload(event, payload);
  for (const key of JOURNEY_PAYLOAD_KEYS) delete merged[key];
  return { ...merged, ...projectJourneyOwnedPayload(owned) };
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
      payload: projectJourneyOwnedPayload({ ...common, funnel_stage: 'entry' }),
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
