import { SITE_ORIGIN } from '@/lib/siteOrigin';

export const MAXVIDEOAI_PLUGIN_REPOSITORY_URL = 'https://github.com/camgraphe/maxvideoai-plugin';
export const MAXVIDEOAI_YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/channel/UCi5XkvmzIaG8gvJPLEs94Mw';

export function buildSiteOrganizationReference() {
  return {
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: 'MaxVideoAI',
    url: `${SITE_ORIGIN}/`,
    sameAs: [MAXVIDEOAI_PLUGIN_REPOSITORY_URL, MAXVIDEOAI_YOUTUBE_CHANNEL_URL],
  } as const;
}

export function buildSiteOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: 'MaxVideoAI',
    alternateName: 'MaxVideo AI',
    url: `${SITE_ORIGIN}/`,
    logo: `${SITE_ORIGIN}/favicon-512.png`,
    description:
      'MaxVideoAI is a pay-as-you-go platform for AI video, image and audio generation, with a web workspace and MCP integrations for compatible AI assistants. Compare models and review the price before generating, without a subscription.',
    sameAs: [
      'https://x.com/MaxVideoAI',
      'https://www.linkedin.com/company/maxvideoai/',
      'https://github.com/camgraphe/maxvideoai',
      MAXVIDEOAI_PLUGIN_REPOSITORY_URL,
      'https://www.producthunt.com/products/maxvideoai',
      MAXVIDEOAI_YOUTUBE_CHANNEL_URL,
    ],
  };
}
