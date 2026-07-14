export type RobotsSurface = 'public' | 'protocol';

const PUBLIC_ASSET_RULES = [
  'Allow: /_next/static/',
  'Allow: /_next/image/',
  'Allow: /assets/',
  'Allow: /hero/',
  'Allow: /favicon.ico',
  'Allow: /api/legal/cookies/version',
];

const PRIVATE_PATH_RULES = [
  'Disallow: /api/',
  'Disallow: /oauth',
  'Disallow: /account',
  'Disallow: /uploads',
  'Disallow: /library',
  'Disallow: /media-library',
  'Disallow: /workspace',
  'Disallow: /docs/private',
  'Disallow: /admin',
  'Disallow: /app',
  'Disallow: /generate',
  'Disallow: /dashboard',
  'Disallow: /jobs',
  'Disallow: /billing',
  'Disallow: /settings',
  'Disallow: /connect',
  'Disallow: /fr/app',
  'Disallow: /fr/generate',
  'Disallow: /fr/dashboard',
  'Disallow: /fr/jobs',
  'Disallow: /fr/billing',
  'Disallow: /fr/settings',
  'Disallow: /fr/connect',
  'Disallow: /es/app',
  'Disallow: /es/generate',
  'Disallow: /es/dashboard',
  'Disallow: /es/jobs',
  'Disallow: /es/billing',
  'Disallow: /es/settings',
  'Disallow: /es/connect',
  'Disallow: /draft',
  'Disallow: /test',
  'Disallow: /private/',
];

const SITEMAP_RULES = [
  'Sitemap: https://maxvideoai.com/sitemap.xml',
  'Sitemap: https://maxvideoai.com/sitemap-en.xml',
  'Sitemap: https://maxvideoai.com/sitemap-fr.xml',
  'Sitemap: https://maxvideoai.com/sitemap-es.xml',
  'Sitemap: https://maxvideoai.com/sitemap-models.xml',
  'Sitemap: https://maxvideoai.com/sitemap-video-pages.xml',
  'Sitemap: https://maxvideoai.com/sitemap-video.xml',
];

function group(agents: string[], rules: string[]) {
  return [...agents.map((agent) => `User-agent: ${agent}`), ...rules].join('\n');
}

export function buildRobotsText(surface: RobotsSurface): string {
  if (surface === 'protocol') {
    return '# MaxVideoAI protocol host\n\nUser-agent: *\nDisallow: /\n';
  }

  const blocks = [
    '# robots.txt - MaxVideoAI public site',
    [
      '# Training-only crawlers are blocked from public content.',
      group(
        ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'Claude-Web', 'CCBot', 'Bytespider', 'cohere-ai'],
        ['Disallow: /'],
      ),
    ].join('\n'),
    [
      '# AI search and user-requested retrieval may read public marketing and documentation.',
      group(
        ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-User', 'Claude-SearchBot'],
        ['Allow: /', ...PUBLIC_ASSET_RULES, ...PRIVATE_PATH_RULES],
      ),
    ].join('\n'),
    [
      '# Ads landing-page validation is separate from AI search and answer retrieval.',
      group(['OAI-AdsBot'], ['Allow: /', ...PUBLIC_ASSET_RULES, ...PRIVATE_PATH_RULES]),
    ].join('\n'),
    [
      '# Deliberate public-content tradeoff: Google-Extended controls both Gemini grounding and future model training.',
      '# It is allowed for acquisition/GEO visibility, while every private path remains disallowed.',
      group(['Google-Extended'], ['Allow: /', ...PUBLIC_ASSET_RULES, ...PRIVATE_PATH_RULES]),
    ].join('\n'),
    [
      'User-agent: *',
      '# Assets required for rendering public pages.',
      ...PUBLIC_ASSET_RULES,
      '',
      '# Sensitive, authenticated, protocol, upload, and private-documentation areas.',
      ...PRIVATE_PATH_RULES,
    ].join('\n'),
    ['# Sitemaps', ...SITEMAP_RULES].join('\n'),
  ];

  return `${blocks.join('\n\n')}\n`;
}
