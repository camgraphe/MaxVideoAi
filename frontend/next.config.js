const path = require('path');
const isPreviewDeployment = process.env.VERCEL_ENV === 'preview';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  transpilePackages: ['@maxvideoai/pricing'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'videohub-uploads-us.s3.amazonaws.com' },
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@ffmpeg-installer/ffmpeg', 'ffprobe-static'],
    outputFileTracingExcludes: {
      '*': ['.next/cache/**/*', 'tsconfig.tsbuildinfo'],
    },
    outputFileTracingRoot: path.join(__dirname, '..'),
  },
  async redirects() {
    return [
      {
        source: '/:path+/',
        destination: '/:path+',
        permanent: true,
      },
      {
        source: '/calculator',
        destination: '/pricing-calculator',
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
    ];
  },
  async headers() {
    if (!isPreviewDeployment) {
      return [];
    }

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
