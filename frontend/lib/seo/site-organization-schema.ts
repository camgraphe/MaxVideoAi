import { SITE_ORIGIN } from '@/lib/siteOrigin';

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
      'Independent hub for AI video generation. Price before you generate. Works with Seedance, Kling, Veo, LTX, Wan, Pika, Sora and more.',
    sameAs: [
      'https://x.com/MaxVideoAI',
      'https://www.linkedin.com/company/maxvideoai/',
      'https://github.com/camgraphe/maxvideoai',
      'https://www.producthunt.com/products/maxvideoai',
    ],
  };
}
