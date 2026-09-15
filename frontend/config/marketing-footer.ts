import {
  MARKETING_FOOTER_EXAMPLES,
  MARKETING_NAV_COMPARE,
  MARKETING_NAV_MODELS,
  type MarketingNavItem,
} from './navigation';

// Editorial selection only. The navigation projections above enforce publication.
// Complete catalogues remain available through their hubs and header menus.
const select = (items: readonly MarketingNavItem[], keys: readonly string[]) =>
  keys.flatMap((key) => items.filter((item) => item.key === key));

export const FOOTER_MODELS = select(MARKETING_NAV_MODELS, [
  'minimax-h3', 'seedance-2-5', 'kling-3-pro', 'veo-3-1',
  'ltx-2-5-pro', 'wan-3', 'wan-3-prime', 'happy-horse-1-1',
]);

export const FOOTER_COMPARISONS = select(MARKETING_NAV_COMPARE, [
  'minimax-h3-vs-seedance-2-5',
  'kling-3-pro-vs-seedance-2-5',
  // Established acquisition pages retained alongside current launches (D85 GSC).
  'seedance-2-0-vs-seedance-2-0-fast',
  'gemini-omni-flash-vs-veo-3-1',
]);

export const FOOTER_EXAMPLES = select(MARKETING_FOOTER_EXAMPLES, [
  'ltx', 'kling', 'seedance', 'wan', 'veo', 'hailuo', 'happy-horse',
]);
