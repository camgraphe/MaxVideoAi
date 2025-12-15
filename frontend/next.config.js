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
const SITEMAP_RUNTIME_GLOBS = [
  // Ensure sitemap generation can read Next build manifests inside the deployed function bundle.
  'frontend/.next/server/app-paths-manifest.json',
  'frontend/.next/app-path-routes-manifest.json',
  'frontend/.next/routes-manifest.json',
  // Some deploys use `frontend` as the project root.
  '.next/server/app-paths-manifest.json',
  '.next/app-path-routes-manifest.json',
  '.next/routes-manifest.json',
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
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
    },
  },
  experimental: {
    serverComponentsExternalPackages: ['@ffmpeg-installer/ffmpeg', 'ffprobe-static'],
    outputFileTracingExcludes: {
      '*': ['.next/cache/**/*', 'tsconfig.tsbuildinfo'],
    },
    outputFileTracingRoot: repoRoot,
    outputFileTracingIncludes: {
      '*': [...CONTENT_GLOBS, ...SITEMAP_RUNTIME_GLOBS],
    },
  },
  async redirects() {
    return [
      {
        source: '/pricing-calculator',
        destination: '/pricing',
        permanent: true,
      },
      {
        source: '/calculator',
        destination: '/pricing',
        permanent: true,
      },
      {
        source: '/storyboard-sora-pro',
        has: [{ type: 'host', value: 'blog.maxvideoai.com' }],
        destination: 'https://maxvideoai.com/blog/sora-2-sequenced-prompts',
        statusCode: 301,
      },
      {
        source: '/fr/pricing-calculator',
        destination: '/fr/tarifs',
        statusCode: 301,
      },
      {
        source: '/fr/simulateur-prix',
        destination: '/fr/tarifs',
        statusCode: 301,
      },
      {
        source: '/es/calculadora-precio',
        destination: '/es/precios',
        statusCode: 301,
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
        destination: '/models/veo-3-1-fast',
        permanent: true,
      },
      {
        source: '/models/veo-3-fast',
        destination: '/models/veo-3-1-fast',
        permanent: true,
      },
      {
        source: '/fr/modeles/veo-3-fast',
        destination: '/fr/modeles/veo-3-1-fast',
        permanent: true,
      },
      {
        source: '/es/modelos/veo-3-fast',
        destination: '/es/modelos/veo-3-1-fast',
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
        source: '/models/minimax-hailuo-02',
        destination: '/models/minimax-hailuo-02-text',
        permanent: true,
      },
      {
        source: '/models/minimax-hailuo-02-image',
        destination: '/models/minimax-hailuo-02-text',
        permanent: true,
      },
      {
        source: '/fr/modeles/minimax-hailuo-02-image',
        destination: '/fr/modeles/minimax-hailuo-02-text',
        permanent: true,
      },
      {
        source: '/es/modelos/minimax-hailuo-02-image',
        destination: '/es/modelos/minimax-hailuo-02-text',
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
        source: '/models/hunyuan-video',
        destination: '/models',
        permanent: true,
      },
      {
        source: '/blog/storyboard-sora-pro',
        destination: '/blog',
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
        destination: '/models/kling-2-5-turbo',
        permanent: true,
      },
      {
        source: '/models/kling-2-5-turbo-pro',
        destination: '/models/kling-2-5-turbo',
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
      {
        source: '/models/veo3fast',
        destination: '/models/veo-3-1-fast',
        permanent: true,
      },
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

    // Ensure login variants stay out of the index regardless of query params
    rules.push({
      source: '/login',
      headers: [
        {
          key: 'X-Robots-Tag',
          value: 'noindex, nofollow',
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
