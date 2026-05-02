const path = require('path');
const isPreviewDeployment = process.env.VERCEL_ENV === 'preview';
const repoRoot = path.join(__dirname, '..');
const CONTENT_GLOBS = [
  '../content/en/blog/**/*',
  '../content/fr/blog/**/*',
  '../content/es/blog/**/*',
  '../content/docs/**/*',
  '../content/fr/docs/**/*',
  '../content/es/docs/**/*',
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
const FFPROBE_NON_RUNTIME_BINARIES = [
  'node_modules/.pnpm/ffprobe-static@*/node_modules/ffprobe-static/bin/darwin/**/*',
  'node_modules/.pnpm/ffprobe-static@*/node_modules/ffprobe-static/bin/win32/**/*',
  'node_modules/.pnpm/ffprobe-static@*/node_modules/ffprobe-static/bin/linux/ia32/**/*',
  'frontend/node_modules/ffprobe-static/bin/darwin/**/*',
  'frontend/node_modules/ffprobe-static/bin/win32/**/*',
  'frontend/node_modules/ffprobe-static/bin/linux/ia32/**/*',
];
const FFPROBE_ALL_BINARIES = [
  'node_modules/.pnpm/ffprobe-static@*/node_modules/ffprobe-static/**/*',
  'frontend/node_modules/ffprobe-static/**/*',
];
const SHARP_NON_RUNTIME_BINARIES = [
  'node_modules/.pnpm/@img+sharp-darwin*/**',
  'node_modules/.pnpm/@img+sharp-win32*/**',
  'node_modules/.pnpm/@img+sharp-wasm32*/**',
  'node_modules/.pnpm/@img+sharp-linux-arm@*/**',
  'node_modules/.pnpm/@img+sharp-linux-s390x*/**',
  'node_modules/.pnpm/@img+sharp-linuxmusl*/**',
  'node_modules/.pnpm/@img+sharp-libvips-darwin*/**',
  'node_modules/.pnpm/@img+sharp-libvips-win32*/**',
  'node_modules/.pnpm/@img+sharp-libvips-linux-arm@*/**',
  'node_modules/.pnpm/@img+sharp-libvips-linux-s390x*/**',
  'node_modules/.pnpm/@img+sharp-libvips-linuxmusl*/**',
  'node_modules/.pnpm/sharp@*/node_modules/@img/sharp-darwin*/**',
  'node_modules/.pnpm/sharp@*/node_modules/@img/sharp-win32*/**',
  'node_modules/.pnpm/sharp@*/node_modules/@img/sharp-wasm32*/**',
  'node_modules/.pnpm/sharp@*/node_modules/@img/sharp-linux-arm/**',
  'node_modules/.pnpm/sharp@*/node_modules/@img/sharp-linux-s390x*/**',
  'node_modules/.pnpm/sharp@*/node_modules/@img/sharp-linuxmusl*/**',
  'node_modules/.pnpm/sharp@*/node_modules/@img/sharp-libvips-darwin*/**',
  'node_modules/.pnpm/sharp@*/node_modules/@img/sharp-libvips-win32*/**',
  'node_modules/.pnpm/sharp@*/node_modules/@img/sharp-libvips-linux-arm/**',
  'node_modules/.pnpm/sharp@*/node_modules/@img/sharp-libvips-linux-s390x*/**',
  'node_modules/.pnpm/sharp@*/node_modules/@img/sharp-libvips-linuxmusl*/**',
];
const SHARP_ALL_BINARIES = [
  'node_modules/.pnpm/@img+sharp*/**',
  'node_modules/.pnpm/sharp@*/node_modules/@img/**/*',
  'frontend/node_modules/sharp/**/*',
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
      { protocol: 'https', hostname: 'media.maxvideoai.com' },
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
  serverExternalPackages: ['@ffmpeg-installer/ffmpeg', 'ffprobe-static'],
  outputFileTracingExcludes: {
    '*': ['.next/cache/**/*', 'tsconfig.tsbuildinfo', ...FFPROBE_NON_RUNTIME_BINARIES, ...SHARP_NON_RUNTIME_BINARIES],
    '/api/tools/upscale': [...FFPROBE_ALL_BINARIES, ...SHARP_ALL_BINARIES],
    '/api/tools/upscale/image': [...FFPROBE_ALL_BINARIES, ...SHARP_NON_RUNTIME_BINARIES],
    '/api/tools/upscale/video': [...FFPROBE_NON_RUNTIME_BINARIES, ...SHARP_ALL_BINARIES],
  },
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    '*': [...CONTENT_GLOBS, ...SITEMAP_RUNTIME_GLOBS],
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
        source: '/es/pricing-calculator',
        destination: '/es/precios',
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
        source: '/models/ltx-2-3',
        destination: '/models/ltx-2-3-pro',
        permanent: true,
      },
      {
        source: '/fr/modeles/ltx-2-3',
        destination: '/fr/modeles/ltx-2-3-pro',
        permanent: true,
      },
      {
        source: '/es/modelos/ltx-2-3',
        destination: '/es/modelos/ltx-2-3-pro',
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
        source: '/fr/modeles/pika-2-2',
        destination: '/fr/modeles/pika-text-to-video',
        permanent: true,
      },
      {
        source: '/es/modelos/pika-2-2',
        destination: '/es/modelos/pika-text-to-video',
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
        source: '/models/veo-3-1-first-last',
        destination: '/models/veo-3-1',
        permanent: true,
      },
      {
        source: '/models/veo-3-1-first-last-fast',
        destination: '/models/veo-3-1-fast',
        permanent: true,
      },
      {
        source: '/fr/modeles/veo-3-fast',
        destination: '/fr/modeles/veo-3-1-fast',
        permanent: true,
      },
      {
        source: '/fr/modeles/veo-3-1-first-last',
        destination: '/fr/modeles/veo-3-1',
        permanent: true,
      },
      {
        source: '/fr/modeles/veo-3-1-first-last-fast',
        destination: '/fr/modeles/veo-3-1-fast',
        permanent: true,
      },
      {
        source: '/es/modelos/veo-3-fast',
        destination: '/es/modelos/veo-3-1-fast',
        permanent: true,
      },
      {
        source: '/es/modelos/veo-3-1-first-last',
        destination: '/es/modelos/veo-3-1',
        permanent: true,
      },
      {
        source: '/es/modelos/veo-3-1-first-last-fast',
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
        source: '/fr/modeles/pika-image-to-video',
        destination: '/fr/modeles/pika-text-to-video',
        permanent: true,
      },
      {
        source: '/es/modelos/pika-image-to-video',
        destination: '/es/modelos/pika-text-to-video',
        permanent: true,
      },
      {
        source: '/models/hailuo-2-pro',
        destination: '/models/minimax-hailuo-02-text',
        permanent: true,
      },
      {
        source: '/examples/ltx-2-fast',
        destination: '/examples/ltx',
        permanent: true,
      },
      {
        source: '/ai-video-engines/best-for/vertical-shorts',
        destination: '/ai-video-engines/best-for/ugc-ads',
        permanent: true,
      },
      {
        source: '/fr/comparatif/best-for/vertical-shorts',
        destination: '/fr/comparatif/best-for/ugc-ads',
        permanent: true,
      },
      {
        source: '/es/comparativa/best-for/vertical-shorts',
        destination: '/es/comparativa/best-for/ugc-ads',
        permanent: true,
      },
      {
        source: '/fr/galerie/ltx-2-fast',
        destination: '/fr/galerie/ltx',
        permanent: true,
      },
      {
        source: '/es/galeria/ltx-2-fast',
        destination: '/es/galeria/ltx',
        permanent: true,
      },
      {
        source: '/examples/ltx-2',
        destination: '/examples/ltx',
        permanent: true,
      },
      {
        source: '/examples/ltx-2-3',
        destination: '/examples/ltx',
        permanent: true,
      },
      {
        source: '/examples/ltx-2-3-pro',
        destination: '/examples/ltx',
        permanent: true,
      },
      {
        source: '/examples/ltx-2-3-fast',
        destination: '/examples/ltx',
        permanent: true,
      },
      {
        source: '/fr/galerie/ltx-2',
        destination: '/fr/galerie/ltx',
        permanent: true,
      },
      {
        source: '/fr/galerie/ltx-2-3',
        destination: '/fr/galerie/ltx',
        permanent: true,
      },
      {
        source: '/fr/galerie/ltx-2-3-pro',
        destination: '/fr/galerie/ltx',
        permanent: true,
      },
      {
        source: '/fr/galerie/ltx-2-3-fast',
        destination: '/fr/galerie/ltx',
        permanent: true,
      },
      {
        source: '/es/galeria/ltx-2',
        destination: '/es/galeria/ltx',
        permanent: true,
      },
      {
        source: '/es/galeria/ltx-2-3',
        destination: '/es/galeria/ltx',
        permanent: true,
      },
      {
        source: '/es/galeria/ltx-2-3-pro',
        destination: '/es/galeria/ltx',
        permanent: true,
      },
      {
        source: '/es/galeria/ltx-2-3-fast',
        destination: '/es/galeria/ltx',
        permanent: true,
      },
      {
        source: '/models/luma-dream-machine',
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
        source: '/chains/:path*',
        destination: '/workflows',
        permanent: true,
      },
      {
        source: '/clip/:path*',
        destination: '/examples',
        permanent: true,
      },
      {
        source: '/modeles/:path*',
        destination: '/fr/modeles/:path*',
        permanent: true,
      },
      {
        source: '/modelos/:path*',
        destination: '/es/modelos/:path*',
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
