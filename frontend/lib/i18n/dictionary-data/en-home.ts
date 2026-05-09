import type { Dictionary } from '../dictionary-types';

export const home: Dictionary['home'] = {
    badges: ['PAY-AS-YOU-GO', 'PRICE-BEFORE', 'ALWAYS-CURRENT'],
    hero: {
      title: 'The right engine for every shot.',
      subtitle: 'Professional AI video, minus the hassle. Price before you generate. One hub for your work.',
      primaryCta: 'Start a render',
      secondaryCta: 'See examples',
    },
    worksWith: {
      label: 'Works with',
      brands: ['Sora 2', 'Veo 3.1', 'Pika 2.2', 'MiniMax Hailuo 02'],
      caption: 'Independent hub. Trademarks belong to their owners.',
      availabilityNotice: 'Availability may vary by provider; pricing chips refresh automatically.',
    },
    heroScreenshot: {
      title: 'Every control in one view.',
      body: 'Composer, live pricing, gallery rail, and job feed stay together so you can tweak prompts, review outputs, and monitor the queue without leaving the screen.',
      alt: 'MaxVideo AI workspace showing the composer, live price chip, and gallery preview in a single dashboard.',
    },
    proofTabs: [
      {
        id: 'workspace',
        label: 'Workspace',
        heading: 'Start in the same workspace we use every day.',
        body: 'Pick an engine, set duration and resolution, and the composer reveals the fields that engine expects. No waitlist, no mockups.',
      },
      {
        id: 'price',
        label: 'Price',
        heading: 'Wallet pricing updates before you press Generate.',
        body: 'Adjust settings and see the live “This render” chip before you commit. Funds only move when the render succeeds.',
      },
      {
        id: 'tracking',
        label: 'Tracking',
        heading: 'Job feed tracks every output automatically.',
        body: 'Review renders, compare takes, and grab downloads from the gallery rail as soon as they finish.',
      },
    ],
    whyCards: [
      {
        title: 'Live product, not a roadmap.',
        body: 'Log in and use the same workspace we run internally — pricing, composer, wallet, and job history are active today.',
      },
      {
        title: 'Wallet-first billing.',
        body: 'Top up once, monitor spend from the header, and refund automatically if a render fails.',
      },
      {
        title: 'All your engines in one place.',
        body: 'Switch between Sora, Veo, Pika, MiniMax, and Hunyuan without juggling dashboards or API keys.',
      },
    ],
    ways: [
      {
        title: 'Generate',
        description: 'Prompt with references, audio toggles, and model-specific controls — all with live pricing.',
        bullets: [
          'Live price chip updates as you tweak duration or resolution',
          'Upload image references or reuse assets from your library',
          'Queue multiple iterations and monitor progress in real time',
        ],
      },
      {
        title: 'Review & deliver',
        description: 'Lock the best take, grab downloads, and share job links without leaving the workspace.',
        bullets: [
          'Gallery rail lines up every render for quick comparisons',
          'Job feed keeps notes, iterations, and status together',
          'Download renders, thumbnails, and metadata instantly',
        ],
      },
    ],
    waysSection: {
      eyebrow: 'Workspace',
      title: 'Everything lives in the workspace.',
      subtitle: 'Composer, wallet, job history, and gallery stay side-by-side so your team stays aligned.',
    },
    examplesCallout: {
      eyebrow: 'Live gallery',
      title: 'See how every engine routes the same brief.',
      subtitle: 'Watch real renders orbit the CTA and jump straight into the Examples page to clone settings for your own project.',
      cta: 'Browse live examples',
    },
    gallery: {
      title: 'Gallery',
      subtitle: 'Captured directly from the live workspace — hover to preview, tap to expand.',
      caption: 'Engine routed for this render.',
      hoverLabel: 'Hover loop preview',
      items: [
        {
          id: 'veo-teaser',
          label: 'Veo 3 · Launch teaser',
          description: 'Narrative lighting with audio on for the campaign reveal.',
          alt: 'Google Veo 3 cinematic teaser.',
          meta: {
            slug: 'veo-3-1',
            pricing: { engineId: 'veo-3-1', durationSec: 8, resolution: '1080p', memberTier: 'member' },
          },
          media: {
            videoSrc: '/assets/gallery/robot-look.mp4',
            posterSrc: '/hero/veo-3-1-hero.jpg',
            hasAudio: true,
          },
        },
        {
          id: 'veo31-fast-demo',
          label: 'Veo 3.1 Fast · Frame bridge',
          description: '8s bridge between a first and last frame using Veo 3.1 Fast.',
          alt: 'Veo 3.1 Fast transition example.',
          meta: {
            slug: 'veo-3-1-fast',
            pricing: { engineId: 'veo-3-1-fast', durationSec: 8, resolution: '720p', memberTier: 'member' },
          },
        media: {
          videoSrc: '/assets/gallery/robot-eyes.mp4',
          posterSrc: '/hero/veo-3-1-hero.jpg',
          hasAudio: true,
        },
      },
        {
          id: 'minimax-hailuo',
          label: 'MiniMax Hailuo 02 · Concept draft',
          description: 'Prompt optimiser enabled to block out a storyboard cut before the hero render.',
          alt: 'MiniMax Hailuo Standard concept animation.',
          meta: {
            slug: 'minimax-hailuo-02-text',
            pricing: { engineId: 'minimax-hailuo-02-text', durationSec: 6, resolution: '768P', memberTier: 'member' },
          },
          media: {
            videoSrc: '/hero/minimax-video01.mp4',
            posterSrc: '/hero/minimax-video01.jpg',
            hasAudio: true,
          },
        },
      ],
    },
    pricing: {
      badge: 'Pricing',
      title: 'Starter Credits unlock the full workspace.',
      body: 'Load $10 and run your first renders immediately. Add $10 / $25 / $50 whenever you need more wallet balance.',
      link: 'Go to pricing',
    },
    trust: {
      badge: 'Operations',
      points: [
        'Independent hub — plug in existing provider accounts or use ours.',
        'Automatic refunds on failed renders with itemised receipts.',
        'Daily status emails keep teams on top of spend and queue health.',
        'Trademarks and logos belong to their owners; we route responsibly.',
      ],
    },
    priceChipSuffix: 'No subscription. Pay-as-you-go.',
  };
