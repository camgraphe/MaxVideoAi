import { getAnalyticsRouteContext, getSafeAnalyticsPath } from '../analytics-route';
import { projectAnalyticsLandingSurface, resolveAnalyticsTouch } from './journey';

type AnalyticsCampaignContext = {
  campaign_source?: string;
  campaign_medium?: string;
  campaign_name?: string;
  campaign_content?: string;
};
export type AnalyticsPageContext = AnalyticsCampaignContext & {
  page_location: string;
  page_path: string;
  page_title: string;
  page_referrer: string;
};

const SITE_HOSTS = new Set(['maxvideoai.com', 'www.maxvideoai.com', 'api.maxvideoai.com']);
const WORKSPACE_SECTIONS = new Set([
  'home', 'studio', 'image', 'audio', 'library', 'tools', 'generate', 'dashboard',
  'jobs', 'settings', 'connect', 'video',
]);
const PUBLIC_ROOTS = new Set([
  'models', 'modeles', 'modelos', 'examples', 'galerie', 'galeria',
  'ai-video-engines', 'comparatif', 'comparativa', 'compare', 'comparisons',
  'blog', 'best-for', 'mcp', 'integrations', 'integraciones', 'tools',
  'pricing', 'tarifs', 'precios', 'studio', 'about', 'contact', 'faq',
  'privacy', 'terms', 'cookies', 'legal', 'docs', 'help', 'changelog',
  'pay-as-you-go-ai-video-generator', 'company', 'benchmarks', 'status', 'workflows', 'editorial-standards',
]);

function approvedCampaign(url: URL): AnalyticsCampaignContext {
  const source = url.searchParams.get('utm_source')?.trim().toLowerCase();
  const medium = url.searchParams.get('utm_medium')?.trim().toLowerCase();
  if (!source || !medium) return {};
  const touch = resolveAnalyticsTouch({
    href: url.href, referrer: '', siteOrigin: url.origin, landingRouteFamily: 'marketing',
  });
  if (touch.source !== source || touch.medium !== medium || touch.source === 'direct') return {};
  return {
    campaign_source: touch.source,
    campaign_medium: touch.medium,
    ...(touch.campaign ? { campaign_name: touch.campaign } : {}),
    ...(touch.content ? { campaign_content: touch.content } : {}),
  };
}

function safeReferrer(referrer: unknown): string {
  if (typeof referrer !== 'string' || !referrer) return '';
  try {
    const url = new URL(referrer);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? `${url.origin}/` : '';
  } catch { return ''; }
}

/** Only transport-owned page context may override Google's implicit URL/title. */
export function buildAnalyticsPageContext(href: unknown, referrer: unknown = ''): AnalyticsPageContext | null {
  if (typeof href !== 'string') return null;
  try {
    const url = new URL(href);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((!SITE_HOSTS.has(url.hostname) && !local) || !/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    const localizedTool = /^\/(fr\/outils|es\/herramientas)(?:\/([^/]+))?\/?$/.exec(url.pathname);
    const routePath = localizedTool ? `/tools${localizedTool[2] ? `/${localizedTool[2]}` : ''}` : url.pathname;
    const route = getAnalyticsRouteContext(routePath);
    let path = getSafeAnalyticsPath(routePath);
    if (route.excludedFromGa4) path = '/excluded';
    else if ((route.family === 'public_tools' || route.family === 'app_tools')
      && !projectAnalyticsLandingSurface(route.family, route.toolName)) {
      path = route.family === 'app_tools' ? '/app/tools' : '/tools';
    }
    else if (localizedTool) path = url.pathname.replace(/\/$/, '');
    else if (route.family === 'workspace' && !WORKSPACE_SECTIONS.has(route.workspaceSection ?? 'home')) path = '/app';
    else if (route.family === 'marketing' && !path.startsWith('/v/')) {
      // Keep public locale/slug identity, never arbitrary paths or encoded identifiers.
      const publicPath = url.pathname.replace(/\/$/, '') || '/';
      const segments = publicPath.replace(/^\/(?:fr|es)(?=\/|$)/, '').split('/').filter(Boolean);
      const allowed = segments.length === 0 || (
        PUBLIC_ROOTS.has(segments[0])
        && segments.length <= 4
        && segments.every(segment => /^[a-z0-9][a-z0-9-]{0,139}$/.test(segment))
        && !/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(publicPath)
      );
      path = allowed ? publicPath : '/other';
    }
    return {
      page_location: `${url.origin}${path}`,
      page_path: path,
      page_title: route.family === 'marketing' || route.family === 'public_tools'
        ? 'MaxVideoAI'
        : `MaxVideoAI — ${route.family}`,
      page_referrer: safeReferrer(referrer),
      ...approvedCampaign(url),
    };
  } catch { return null; }
}

export function readBrowserAnalyticsPageContext(): AnalyticsPageContext | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  return buildAnalyticsPageContext(window.location.href, document.referrer);
}

export function isBrowserAnalyticsRouteExcluded(): boolean {
  return typeof window !== 'undefined' && getAnalyticsRouteContext(window.location.pathname).excludedFromGa4;
}

export function withSafeAnalyticsPageContext(payload: Record<string, unknown>): Record<string, unknown> {
  const observed = buildAnalyticsPageContext(payload.page_location, payload.page_referrer);
  const context = observed ?? readBrowserAnalyticsPageContext();
  const rest = { ...payload };
  for (const key of ['page_location', 'page_path', 'page_title', 'page_referrer',
    'campaign_source', 'campaign_medium', 'campaign_name', 'campaign_content']) delete rest[key];
  if (!context) return rest;
  // Revalidate retained campaign fields through the same approved UTM contract.
  // This preserves native GA attribution while page_location stays query-free.
  const campaignUrl = new URL(context.page_location);
  for (const [field, parameter] of [
    ['campaign_source', 'utm_source'], ['campaign_medium', 'utm_medium'],
    ['campaign_name', 'utm_campaign'], ['campaign_content', 'utm_content'],
  ]) {
    const value = payload[field];
    if (typeof value === 'string') campaignUrl.searchParams.set(parameter, value);
  }
  return { ...rest, ...context, ...approvedCampaign(campaignUrl) };
}
