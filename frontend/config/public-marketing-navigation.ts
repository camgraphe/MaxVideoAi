import { FOOTER_COMPARISONS, FOOTER_EXAMPLES, FOOTER_MODELS } from './marketing-footer';
import {
  MARKETING_NAV_ASSISTANTS, MARKETING_NAV_BEST_FOR_HUB, MARKETING_NAV_DROPDOWNS, MARKETING_SITE_NAV_LINKS,
} from './navigation';

// Resolve publication once on the server. Interactive marketing navigation needs
// the public destinations, not the catalog and pair policy used to choose them.
export const marketingHeaderNavigation = { links: MARKETING_SITE_NAV_LINKS, dropdowns: MARKETING_NAV_DROPDOWNS };
export const marketingFooterNavigation = {
  models: FOOTER_MODELS, comparisons: FOOTER_COMPARISONS, examples: FOOTER_EXAMPLES,
  bestFor: MARKETING_NAV_BEST_FOR_HUB, assistants: MARKETING_NAV_ASSISTANTS,
};

export type MarketingHeaderNavigation = typeof marketingHeaderNavigation;
export type MarketingFooterNavigation = typeof marketingFooterNavigation;
