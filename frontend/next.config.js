const path = require('path');
const isPreviewDeployment = process.env.VERCEL_ENV === 'preview';
const repoRoot = path.join(__dirname, '..');
const CONTENT_GLOBS = [
  '../content/en/blog/**/*',
  '../content/fr/blog/**/*',
  '../content/es/blog/**/*',
  '../content/docs/**/*',
  '../content/models/**/*',
];

const withNextIntl = require('next-intl/plugin')('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  trailingSlash: false,
  transpilePackages: ['@maxvideoai/pricing'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'videohub-uploads-us.s3.amazonaws.com' },
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: '*.fal.media' },
      { protocol: 'https', hostname: 'fal.media' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@ffmpeg-installer/ffmpeg', 'ffprobe-static'],
    outputFileTracingExcludes: {
      '*': ['.next/cache/**/*', 'tsconfig.tsbuildinfo'],
    },
    outputFileTracingRoot: repoRoot,
    outputFileTracingIncludes: {
      '*': CONTENT_GLOBS,
    },
  },
  async redirects() {
    const localeSafeRedirects = [
      {
        source: '/fr/galerie',
        destination: '/fr/examples',
        permanent: true,
      },
      {
        source: '/fr/comparatif',
        destination: '/fr/ai-video-engines',
        permanent: true,
      },
      {
        source: '/fr/tarifs',
        destination: '/fr/pricing',
        permanent: true,
      },
      {
        source: '/fr/modeles/:slug*',
        destination: '/fr/models/:slug*',
        permanent: true,
      },
      {
        source: '/es/precios',
        destination: '/es/pricing',
        permanent: true,
      },
      {
        source: '/es/modelos/:slug*',
        destination: '/es/models/:slug*',
        permanent: true,
      },
    ];

    return [
      {
        source: '/calculator',
        destination: '/pricing-calculator',
        permanent: true,
      },
      {
        source: '/fr/simulateur-prix',
        destination: '/pricing-calculator?lang=fr',
        permanent: true,
      },
      {
        source: '/es/calculadora-precio',
        destination: '/pricing-calculator?lang=es',
        permanent: true,
      },
      {
        source: '/docs/getting-started',
        destination: '/docs/get-started',
        permanent: true,
      },
      {
        source: '/models/openai-sora-2',
        destination: '/models/sora-2',
        permanent: true,
      },
      {
        source: '/models/openai-sora-2-pro',
        destination: '/models/sora-2-pro',
        permanent: true,
      },
      {
        source: '/models/google-veo-3',
        destination: '/models/veo-3',
        permanent: true,
      },
      {
        source: '/models/veo-3',
        destination: '/models/veo-3-1',
        permanent: true,
      },
      {
        source: '/models/pika-2-2',
        destination: '/models/pika-text-to-video',
        permanent: true,
      },
      {
        source: '/models/google-veo-3-fast',
        destination: '/models/veo-3-fast',
        permanent: true,
      },
      {
        source: '/models/minimax-video-01',
        destination: '/models/minimax-hailuo-02-text',
        permanent: true,
      },
      {
        source: '/models/minimax-hailuo-02-pro',
        destination: '/models/minimax-hailuo-02-text',
        permanent: true,
      },
      {
        source: '/models/minimax-video-1',
        destination: '/models/minimax-hailuo-02-text',
        permanent: true,
      },
      {
        source: '/models/hailuo-2-pro',
        destination: '/models/minimax-hailuo-02-text',
        permanent: true,
      },
      {
        source: '/models/luma-dream-machine',
        destination: '/models',
        permanent: true,
      },
      {
        source: '/models/luma-ray-2',
        destination: '/models',
        permanent: true,
      },
      {
        source: '/models/luma-ray-2-flash',
        destination: '/models',
        permanent: true,
      },
      {
        source: '/fr/sitemap-video.xml',
        destination: '/sitemap-video.xml',
        permanent: true,
      },
      {
        source: '/es/sitemap-video.xml',
        destination: '/sitemap-video.xml',
        permanent: true,
      },
      {
        source: '/models/kling-25-turbo-pro',
        destination: '/models',
        permanent: true,
      },
      {
        source: '/models/kling-2-5-turbo-pro',
        destination: '/models',
        permanent: true,
      },
      {
        source: '/blog/express-case-study',
        destination: '/blog/compare-ai-video-engines',
        permanent: true,
      },
      {
        source: '/blog/veo-v2-arrives',
        destination: '/blog/veo-3-updates',
        permanent: true,
      },
      {
        source: '/privacy',
        destination: '/legal/privacy',
        permanent: true,
      },
      {
        source: '/terms',
        destination: '/legal/terms',
        permanent: true,
      },
      {
        source: '/legal/privacy/',
        destination: '/legal/privacy',
        permanent: true,
      },
      {
        source: '/legal/terms/',
        destination: '/legal/terms',
        permanent: true,
      },
      {
        source: '/en',
        destination: '/',
        permanent: true,
      },
      {
        source: '/en/:path*',
        destination: '/:path*',
        permanent: true,
      },
      ...localeSafeRedirects,
    ];
  },
  async headers() {
    const rules = [];

    // Always ensure robots.txt is not cached so changes propagate immediately
    rules.push({
      source: '/robots.txt',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-store, must-revalidate',
        },
      ],
    });

    // In preview deployments, block indexing site-wide
    if (isPreviewDeployment) {
      rules.push({
        source: '/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow',
          },
        ],
      });
    }

    return rules;
  },
};

module.exports = withNextIntl(nextConfig);
