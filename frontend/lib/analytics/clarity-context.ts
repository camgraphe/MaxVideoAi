import { getAnalyticsRouteContext, getSafeAnalyticsPath, shouldLoadMarketingAnalytics } from '@/lib/analytics-route';

/** Public dimensions only; query strings and private route identifiers never become tags. */
export function getClarityPageTags(pathname: string): Record<string, string> | null {
  const context = getAnalyticsRouteContext(pathname);
  if (!shouldLoadMarketingAnalytics(context.family) || /^\/(oauth|v|s|mcp\/reference-upload)(\/|$)/.test(context.normalizedPath)) return null;
  const section = context.normalizedPath.split('/')[1] ?? '';
  const categories: Record<string, string> = {
    '': 'home', models: 'models', modeles: 'models', modelos: 'models',
    examples: 'examples', galerie: 'examples', galeria: 'examples',
    'ai-video-engines': 'comparisons', comparatif: 'comparisons', comparativa: 'comparisons', compare: 'comparisons',
    mcp: 'mcp', integrations: 'integrations', integraciones: 'integrations',
    pricing: 'pricing', tarifs: 'pricing', precios: 'pricing',
    blog: 'blog', docs: 'documentation', tools: 'public_tools',
    'pay-as-you-go-ai-video-generator': 'pay_as_you_go',
  };
  return {
    page: getSafeAnalyticsPath(pathname),
    page_category: categories[section] ?? 'other_public',
    page_locale: pathname.match(/^\/(fr|es)(\/|$)/)?.[1] ?? 'en',
    route_family: context.family,
  };
}

/** Existing canonical application events, distinct from Clarity's no-code heuristics. */
export const CLARITY_ANALYTICS_EVENTS = new Set([
  'cta_click', 'tool_cta_click', 'hero_start_render_click', 'hero_examples_click', 'hero_compare_click',
  'model_card_click', 'example_category_click', 'comparison_card_click', 'mcp_internal_link_click',
  'shot_type_card_click', 'tool_card_click', 'pricing_cta_click',
  'mcp_landing_cta_clicked', 'mcp_endpoint_copy_clicked',
  'sign_up_started', 'sign_up_completed', 'login_completed',
  'app_open', 'studio_entered', 'first_media_completed_in_journey',
  'tool_start', 'tool_complete', 'generation_started', 'generation_completed', 'generation_failed',
  'topup_started', 'topup_checkout_opened', 'topup_completed', 'topup_cancelled', 'topup_failed',
]);
