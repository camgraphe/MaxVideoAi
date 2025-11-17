import type { PricingScenario } from '@/lib/pricing-scenarios';
import type { EngineAvailability } from '@/types/engines';

export type Locale = 'en' | 'fr';

type Dictionary = {
  nav: {
    brand: string;
    links: Array<{ key: string; href: string }>;
    login: string;
    cta: string;
    linkLabels: Record<string, string>;
  };
  footer: {
    links: Array<{ label: string; href: string }>;
    brandNote: string;
    languageLabel: string;
    languages: Array<{ locale: Locale; label: string }>;
  };
  home: {
    badges: string[];
    hero: {
      title: string;
      subtitle: string;
      primaryCta: string;
      secondaryCta: string;
    };
    worksWith: {
      label: string;
      brands?: string[];
      caption: string;
      availabilityNotice: string;
    };
    heroScreenshot: {
      title: string;
      body: string;
      alt: string;
    };
    proofTabs: Array<{ id: string; label: string; heading: string; body: string }>;
    whyCards: Array<{ title: string; body: string }>;
    ways: Array<{ title: string; description: string; bullets: string[] }>;
    waysSection: { title: string; subtitle: string };
    examplesCallout?: {
      eyebrow?: string;
      title: string;
      subtitle?: string;
      cta: string;
    };
    gallery: {
      title: string;
      subtitle: string;
      caption: string;
      hoverLabel: string;
      items: Array<{
        id: string;
        label: string;
        description: string;
        alt: string;
        meta: {
          slug: string;
          pricing: { engineId: string; durationSec: number; resolution: string; memberTier?: string };
        };
        media?: {
          videoSrc: string;
          posterSrc?: string;
          hasAudio?: boolean;
        };
      }>;
    };
    pricing: {
      badge: string;
      title: string;
      body: string;
      link: string;
    };
    trust: {
      badge: string;
      points: string[];
    };
    priceChipSuffix: string;
    priceChipPrefix?: string;
  };
  pricing: {
    hero: {
      title: string;
      subtitle: string;
    };
    estimator: {
      title: string;
      subtitle: string;
      walletLink: string;
      walletLinkCta: string;
      chargedNote: string;
      fields: {
        engine: string;
        resolution: string;
        duration: string;
        memberStatus: string;
      };
      estimateLabels: {
        heading: string;
        base: string;
        discount: string;
        memberChipPrefix: string;
      };
      descriptions: Record<string, string>;
      engineRateLabel?: string;
      durationLabel?: string;
      resolutionLabel?: string;
    };
    wallet: {
      title: string;
      description: string;
      points: string[];
      balanceLabel?: string;
      balanceHelper?: string;
      autoTopUpLabel?: string;
      autoTopUpHint?: string;
      addLabel?: string;
    };
    teams: {
      title: string;
      description: string;
      comingSoonNote?: string;
      points: string[];
    };
    member: {
      title: string;
      subtitle: string;
      tiers: Array<{ name: string; requirement: string; benefit: string }>;
      chipBase: string;
      tooltip: string;
    };
    refunds: {
      title: string;
      points: string[];
    };
    faq: {
      title: string;
      entries: Array<{ question: string; answer: string }>;
    };
    priceChipSuffix: string;
    priceChipPrefix?: string;
  };
  calculator: {
    hero: {
      title: string;
      subtitle: string;
    };
    lite: {
      title: string;
      subtitle: string;
      footer: string;
      footerLinkText: string;
    };
  };
  workflows: {
    hero: {
      title: string;
      subtitle: string;
    };
    express: {
      badge: string;
      title: string;
      features: string[];
    };
    workflows: {
      badge: string;
      title: string;
      features: string[];
    };
  };
  models: {
    hero: {
      title: string;
      subtitle: string;
    };
    availabilityLabels: Record<EngineAvailability, string>;
    meta: Record<string, { displayName: string; description: string; priceBefore: string; versionLabel?: string }>;
    note: string;
  };
  examples: {
    hero: {
      title: string;
      subtitle: string;
    };
    items: Array<{
      title: string;
      engine: string;
      description: string;
      alt: string;
      meta?: {
        slug: string;
        pricing: PricingScenario;
      };
      media?: {
        videoSrc: string;
        posterSrc?: string;
        aspectRatio?: '16:9' | '9:16' | '1:1';
      };
    }>;
    cta: string;
  };
  docs: {
    hero: {
      title: string;
      subtitle: string;
    };
    sections: Array<{ title: string; items: Array<string | { type: 'link'; before: string; terms: string; and: string; privacy: string; after: string }> }>;
    empty: string;
    libraryHeading?: string;
  };
  blog: {
    hero: {
      title: string;
      subtitle: string;
    };
    empty: string;
    cta?: string;
  };
  about: {
    hero: {
      title: string;
      subtitle: string;
    };
    paragraphs: string[];
    note: string;
  };
  contact: {
    hero: {
      title: string;
      subtitle: string;
    };
    form: {
      name: string;
      email: string;
      topic: string;
      selectPlaceholder: string;
      topics: Array<{ value: string; label: string }>;
      message: string;
      submit: string;
      alt: string;
    };
  };
  legal: {
    terms: {
      title: string;
      intro: string;
      sections: Array<{ heading: string; body: string }>;
    };
    privacy: {
      title: string;
      intro: string;
      sections: Array<{ heading: string; body: string }>;
    };
  };
  changelog: {
    hero: {
      title: string;
      subtitle: string;
    };
    entries: Array<{ date: string; title: string; body: string }>;
  };
  status: {
    hero: {
      title: string;
      subtitle: string;
    };
    systems: Array<{ name: string; status: string; detail: string }>;
    incidents: Array<{ date: string; title: string; summary: string; status: string }>;
  };
  systemMessages: {
    refundInitiated: string;
    partialRefund: string;
    paymentRetried: string;
  };
};

const en: Dictionary = {
  nav: {
    brand: 'MaxVideo AI',
    links: [
      { key: 'models', href: '/models' },
      { key: 'examples', href: '/examples' },
      { key: 'pricing', href: '/pricing' },
      { key: 'workflows', href: '/workflows' },
      { key: 'docs', href: '/docs' },
      { key: 'blog', href: '/blog' },
    ],
    login: 'Log in',
    cta: 'Start a render',
    linkLabels: {
      models: 'Models',
      examples: 'Examples',
      pricing: 'Pricing',
      workflows: 'Workflows',
      docs: 'Docs',
      blog: 'Blog',
    },
  },
  footer: {
    links: [
      { label: 'Blog', href: '/blog' },
      { label: 'Terms', href: '/legal/terms' },
      { label: 'Privacy', href: '/legal/privacy' },
      { label: 'Acceptable Use', href: '/legal/acceptable-use' },
      { label: 'Notice & Takedown', href: '/legal/takedown' },
    ],
    brandNote:
      'Independent hub for professional AI video - price before you generate, stay on the latest engines, one workspace for every shot. Works with Sora 2, Veo 3.1, Pika 2.2, MiniMax Hailuo 02, and more. Trademarks belong to their owners.',
    languageLabel: 'Language',
    languages: [
      { locale: 'en', label: 'English' },
      { locale: 'fr', label: 'French' },
    ],
  },
  home: {
    badges: ['PAY-AS-YOU-GO', 'PRICE-BEFORE', 'ALWAYS-CURRENT'],
    hero: {
      title: 'The right engine for every shot.',
      subtitle: 'Professional AI video, minus the hassle. Price before you generate. One hub for your work.',
      primaryCta: 'Start a render',
      secondaryCta: 'See how it works',
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
            posterSrc: '/hero/veo3.jpg',
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
          posterSrc: '/hero/veo3.jpg',
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
            videoSrc: '/assets/gallery/aerial-road.mp4',
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
  },
  pricing: {
    hero: {
      title: 'Price before you generate. Pay only for what you run. Start with Starter Credits ($10). No subscription. No lock-in.',
      subtitle: 'Every estimate updates live as you adjust engines, durations, and outputs. Wallet balances sync across teams with daily status checks.',
    },
    estimator: {
      title: 'Cost Estimator',
      subtitle: 'Choose the engine, duration, and resolution to see pricing before you queue the render. Charged only if it succeeds.',
      walletLink: 'Want a public version for clients?',
      walletLinkCta: 'Open the calculator',
      chargedNote: 'Charged only if render succeeds.',
      fields: {
        engine: 'Engine',
        resolution: 'Resolution',
        duration: 'Duration (seconds)',
        memberStatus: 'Member status',
      },
      estimateLabels: {
        heading: 'Estimate',
        base: 'Base',
        discount: 'Discount',
        memberChipPrefix: 'Member price — You save',
      },
      descriptions: {
        'sora-2': 'Text/image remix with native audio.',
        'veo-3-1': 'Swap between text-to-video prompts or multi-image reference control.',
        'pika-text-to-video': 'Quick social loops with captions and remix-friendly settings.',
        'minimax-hailuo-02-text': 'Prompt-optimised drafts before the hero render.',
      },
      engineRateLabel: 'Engine rate',
      durationLabel: 'Duration',
      resolutionLabel: 'Resolution',
    },
    wallet: {
      title: 'Wallet',
      description: 'Fund your wallet with Starter Credits ($10) or add $10 / $25 / $50 at a time. Optional auto top-up keeps renders moving.',
      points: [
        'Starter Credits ($10) to get rolling instantly.',
        'Add funds in $10, $25, or $50 increments when you need them.',
        'Optional auto top-up with alerts when balance drops below your threshold.',
      ],
      balanceLabel: 'Wallet balance',
      balanceHelper: 'Starter Credits begin at $10. Shared wallets sync automatically.',
      autoTopUpLabel: 'Auto top-up when balance dips below $10',
      autoTopUpHint: 'Daily status emails keep finance in the loop.',
      addLabel: 'Add ${amount}',
    },
    teams: {
      title: 'Teams',
      description: 'Role-based approvals, shared wallets, and delivery hand-offs roll out next. Join the beta to test team controls early.',
      comingSoonNote: 'Teams features are in private beta. Contact support@maxvideoai.com to join the rollout.',
      points: [
        'Role-based shared wallets with approvals across finance, producers, and stakeholders.',
        'Automated daily summaries covering spend, refunds, and queue health.',
        'Delivery hand-offs to Google Drive, OneDrive, and Dropbox.',
      ],
    },
    member: {
      title: 'Member status',
      subtitle: 'Discounts update instantly when admins edit thresholds in Settings → Billing → Member tiers.',
      tiers: [
        {
          name: 'Member',
          requirement: 'Default status',
          benefit: 'Standard pricing. Chip reads “Member price”.',
        },
        {
          name: 'Plus',
          requirement: 'Admin-defined threshold',
          benefit: 'Workspace discount set in Billing.',
        },
        {
          name: 'Pro',
          requirement: 'Admin-defined threshold',
          benefit: 'Workspace discount set in Billing.',
        },
      ],
      chipBase: 'Member price — You save',
      tooltip: 'Status updates daily on your last 30 days of spend.',
    },
    refunds: {
      title: 'Refunds & protections',
      points: [
        'Automatic refunds when renders fail or providers miss SLAs.',
        'Itemised receipts with engine, duration, resolution, and add-ons.',
        'Wallet protections with optional multi-approver top-ups.',
        'Application fee is recognised immediately; vendor share settles on payout.',
        'Every render attempt carries an idempotency key to prevent duplicate charges.',
      ],
    },
    faq: {
      title: 'Micro-FAQ',
      entries: [
        {
          question: 'How do credits work?',
          answer: 'Starter Credits load $10 into your wallet. Spend them like cash and top up whenever you need more runs.',
        },
        {
          question: 'Do they expire?',
          answer: 'No expiry. Balances roll forward month to month and sync across every teammate with access.',
        },
        {
          question: 'What if a generation fails?',
          answer: 'Failed renders auto-refund within minutes. You only pay when the job completes successfully.',
        },
        {
          question: 'What are member discounts?',
          answer: 'Spend $50 in 30 days to save 5%, $200 to save 10%. Savings apply automatically to every eligible run.',
        },
      ],
    },
    priceChipSuffix: 'Price before you generate.',
    priceChipPrefix: 'This render',
  },
  calculator: {
    hero: {
      title: 'Estimate your AI video cost before you generate.',
      subtitle: 'This public calculator mirrors the estimator inside MaxVideo AI. Pick an engine, duration, and resolution to preview the cost chip with no login required.',
    },
    lite: {
      title: 'Lite calculator',
      subtitle: 'Great for stakeholders who need a quick estimate before sharing prompts or assets.',
      footer: 'Ready to run the job? {link} to fund your wallet and generate inside the workspace.',
      footerLinkText: 'Head to Pricing',
    },
  },
  workflows: {
    hero: {
      title: 'Express vs Workflows.',
      subtitle:
        'Express handles rapid experimentation. Workflows keeps the live “Price before you generate” chip today, with additional delivery integrations rolling out gradually.',
    },
    express: {
      badge: 'Express',
      title: 'Spin up publish-ready clips in minutes.',
      features: [
        'Template library with prompt scaffolds and guardrails',
        'Caption burn-in and optional voiceover generation',
        'Auto ratio exports for 16:9, 1:1, 9:16, 4:5',
      ],
    },
    workflows: {
      badge: 'Workflows',
      title: 'Full hand-off for brand and post teams.',
      features: [
        'Price before you generate chip (live)',
        'Delivery via Google Drive, OneDrive, Dropbox (coming soon)',
        'Nano Banana image (coming soon)',
      ],
    },
  },
  models: {
    hero: {
      title: 'One workspace, every video engine that matters.',
      subtitle:
        'Fal.ai drops new endpoints weekly — we pull them in automatically so your pricing and model catalog stay fresh across Sora, Veo, Pika, MiniMax, Kling, Wan, and Nano Banana.',
    },
    availabilityLabels: {
      available: 'Available',
      limited: 'Limited access',
      waitlist: 'Waitlist',
      paused: 'Paused',
    },
    meta: {
      'sora-2': {
        displayName: 'OpenAI Sora 2',
        description: 'Text-to-video and remix with native audio via Fal routing.',
        priceBefore: 'Live pricing updates inside the Generate workspace.',
        versionLabel: 'v2',
      },
      'sora-2-pro': {
        displayName: 'OpenAI Sora 2 Pro',
        description: 'Cinematic lip-sync with 1080p output and image-to-video control for premium teams.',
        priceBefore: 'Live pricing updates inside the Generate workspace.',
        versionLabel: 'Pro',
      },
      'veo-3-1': {
        displayName: 'Google Veo 3.1',
        description: 'Reference-to-video control with multi-image subject guidance.',
        priceBefore: 'Live pricing updates inside the Generate workspace.',
        versionLabel: 'Veo 3.1',
      },
      'veo-3-1-fast': {
        displayName: 'Google Veo 3.1 Fast',
        description: 'Run fast text prompts or animate a single reference image with optional audio.',
        priceBefore: 'Live pricing updates inside the Generate workspace.',
        versionLabel: 'Veo 3.1 Fast',
      },
      'veo-3-1-first-last': {
        displayName: 'Google Veo 3.1 First/Last Frame',
        description: 'Upload first & last frames, describe the bridge, and animate with Veo 3.1 or Veo 3.1 Fast.',
        priceBefore: 'Live pricing updates inside the Generate workspace.',
        versionLabel: 'First/Last',
      },
      'pika-text-to-video': {
        displayName: 'Pika 2.2 · Text & Image to Video',
        description: 'Social-first loops from prompts or uploaded stills with fast iteration.',
        priceBefore: 'Live pricing updates inside the Generate workspace.',
        versionLabel: '2.2',
      },
      'minimax-hailuo-02-text': {
        displayName: 'MiniMax Hailuo 02 Standard · Text & Image to Video',
        description: 'Prompt optimiser-enabled drafts or reference-driven animation in one engine.',
        priceBefore: 'Live pricing updates inside the Generate workspace.',
        versionLabel: 'Standard',
      },
    },
    note: '',
  },
  examples: {
    hero: {
      title: 'Engine showcases.',
      subtitle: 'Hover to loop, click to expand. Each clip previews the motion and style you can route in MaxVideo AI.',
    },
    items: [
      {
        title: 'Sora 2 cinematic',
        engine: 'Sora 2 · Text-to-video · 16:9',
        description: 'Cinematic motion pass capturing atmospheric lighting and parallax.',
        alt: 'Sora 2 example clip.',
        meta: {
          slug: 'sora-2',
          pricing: { engineId: 'sora-2', durationSec: 10, resolution: '1080p', memberTier: 'member' },
        },
        media: {
          videoSrc: '/hero/sora2.mp4',
          aspectRatio: '16:9',
        },
      },
      {
        title: 'Veo 3 branded flythrough',
        engine: 'Veo 3.1 · Image-to-video · 16:9',
        description: 'Depth-rich branded flythrough emphasising camera control.',
        alt: 'Veo 3 example clip.',
        meta: {
          slug: 'veo-3-1',
          pricing: { engineId: 'veo-3-1', durationSec: 8, resolution: '1080p', memberTier: 'member' },
        },
        media: {
          videoSrc: '/hero/veo3.mp4',
          aspectRatio: '16:9',
        },
      },
      {
        title: 'Veo 3.1 Fast storyboard pass',
        engine: 'Veo 3.1 Fast · Text-to-video · 16:9',
        description: 'Fast queue render with optional ambient audio to validate motion before the hero clip.',
        alt: 'Veo 3.1 Fast example clip.',
        meta: {
          slug: 'veo-3-1-fast',
          pricing: { engineId: 'veo-3-1-fast', durationSec: 8, resolution: '720p', memberTier: 'member' },
        },
        media: {
          videoSrc: '/hero/veo3.mp4',
          aspectRatio: '16:9',
        },
      },
      {
        title: 'Pika 2.2 social loop',
        engine: 'Pika 2.2 · Text-to-video · 16:9',
        description: 'Fast-paced social loop with stylised motion accents.',
        alt: 'Pika 2.2 example clip.',
        meta: {
          slug: 'pika-text-to-video',
          pricing: { engineId: 'pika-text-to-video', durationSec: 8, resolution: '1080p', memberTier: 'member' },
        },
        media: {
          videoSrc: '/hero/pika-22.mp4',
          aspectRatio: '16:9',
        },
      },
      {
        title: 'MiniMax Hailuo concept pass',
        engine: 'MiniMax Hailuo 02 · Text/Image-to-video · 16:9',
        description: 'Animated concept art pass driven by a single reference frame.',
        alt: 'MiniMax Hailuo Standard example clip.',
        meta: {
          slug: 'minimax-hailuo-02-text',
          pricing: { engineId: 'minimax-hailuo-02-text', durationSec: 10, resolution: '768P', memberTier: 'member' },
        },
        media: {
          videoSrc: '/hero/minimax-video01.mp4',
          aspectRatio: '16:9',
        },
      },
    ],
    cta: 'Generate similar video',
  },
  docs: {
    hero: {
      title: 'Documentation',
      subtitle:
        'Start here for onboarding, brand safety, works-with notices, and refund policies. Deeper integration guides live in the authenticated workspace.',
    },
    sections: [
      {
        title: 'Brief',
        items: [
          'Fill the brand brief once so saved defaults and routing hints work for everyone.',
          'Share tone, context, and deliverables so each teammate can render without extra back-and-forth.',
        ],
      },
      {
        title: 'Price system',
        items: [
          'Preview the exact price before you render. The price chip updates with duration, resolution, and automatic discounts.',
          'Starter Credits ($10) and rolling Member status (Member / Plus / Pro) update daily.',
        ],
      },
      {
        title: 'Refunds',
        items: [
          'If a render fails, your wallet is automatically refunded within minutes and the job includes a short incident note.',
          'Itemised receipts list engine, duration, resolution, and a job ID—easy hand-off to finance.',
          {
            type: 'link',
            before: 'For legal detail, see ',
            terms: 'Terms',
            and: ' and ',
            privacy: 'Privacy',
            after: '.',
          },
        ],
      },
      {
        title: 'Brand-safe filters',
        items: [
          'We block risky prompts, uploads, and outputs by default—so teams stay within policy without extra babysitting.',
          'Sensitive cases route to human review with an audit trail and simple escalation options when needed.',
          'Admins can request custom allowlists or restricted keywords per workspace.',
        ],
      },
      {
        title: 'API references',
        items: [
          'Webhook callbacks for renders, refunds, and queue updates.',
          'REST and GraphQL references live inside the authenticated docs.',
          'SDK examples cover Node.js, Python, and direct webhook verification.',
        ],
      },
    ],
    empty: 'Documentation coming soon.',
    libraryHeading: 'Library',
  },
  blog: {
    hero: {
      title: 'The MaxVideo AI blog.',
      subtitle:
        'News on engines, customer stories, prompt guides, and price-before best practices. Subscribe in-app to get updates in your queue digest.',
    },
    empty: 'Blog posts coming soon.',
    cta: 'Read more',
  },
  about: {
    hero: {
      title: 'Quiet confidence for AI video teams.',
      subtitle:
        'MaxVideo AI is the independent hub for AI video production. We route to the right engine for every shot, price before you generate, and keep your team in control without vendor lock-in.',
    },
    paragraphs: [
      'We believe professional teams deserve clarity before they hit render. That means price transparency, reliable routing, and shared context between creatives, producers, and stakeholders.',
      'Independence matters: we stay neutral across engines, integrate with Sora 2, Veo 3.1, Veo 3 Fast, Pika 2.2, MiniMax Hailuo 02, Hunyuan Image, and rotating betas, and list trademarks only to describe compatibility.',
      'The product is engineered for teams that need precision without noise. Quiet UI, premium defaults, precise controls, and price-before chips that keep finance in the loop.',
    ],
    note:
      'Trademarks and service marks are property of their respective owners. MaxVideo AI stays independent so you can stay current without switching platforms.',
  },
  contact: {
    hero: {
      title: 'Contact the team.',
      subtitle: 'Need support, enterprise onboarding, or press information? Send a note and we’ll reply within one business day.',
    },
    form: {
      name: 'Name',
      email: 'Email',
      topic: 'Topic',
      selectPlaceholder: 'Select a topic',
      topics: [
        { value: 'support', label: 'Support' },
        { value: 'sales', label: 'Sales' },
        { value: 'partnerships', label: 'Partnerships' },
        { value: 'press', label: 'Press' },
      ],
      message: 'Message',
      submit: 'Send message',
      alt: 'Prefer email? Write to {email}.',
    },
  },
  legal: {
    terms: {
      title: 'Terms of service',
      intro: 'This overview will be replaced by the final legal document. Contact legal@maxvideo.ai for questions.',
      sections: [
        { heading: '1. Overview', body: 'These Terms govern your use of MaxVideo AI. By accessing the service you agree to the obligations below.' },
        { heading: '2. Accounts', body: 'You are responsible for maintaining account security and ensuring teammates comply with these Terms.' },
        { heading: '3. Usage', body: 'Use MaxVideo AI in compliance with all applicable laws, respect licensing limits, and avoid prohibited content.' },
        { heading: '4. Billing', body: 'Wallet charges apply only to successful renders. Refunds are issued automatically for failed jobs.' },
        { heading: '5. Liability', body: 'MaxVideo AI is provided as-is. We limit liability to the maximum extent permitted by law.' },
      ],
    },
    privacy: {
      title: 'Privacy policy',
      intro: 'Highlights of our privacy practices. Final legal copy will live here.',
      sections: [
        { heading: '1. Data we collect', body: 'Workspace details, usage metrics, and billing information needed to deliver the service.' },
        { heading: '2. How we use data', body: 'Operate routing, improve product quality, and communicate critical updates.' },
        { heading: '3. Storage & security', body: 'We store data in encrypted systems with least-privilege access. Render assets auto-expire per workspace policy.' },
        { heading: '4. Sharing', body: 'We only share data with underlying engine providers when routing renders. We never sell customer data.' },
        { heading: '5. Your choices', body: 'Request export or deletion any time via support@maxvideo.ai. Admins control retention windows.' },
      ],
    },
  },
  changelog: {
    hero: {
      title: 'Changelog',
      subtitle: 'Every engine update, workflow improvement, and pricing tweak — published weekly. Subscribe inside the app for alerts.',
    },
    entries: [
      {
        date: '2024-06-12',
        title: 'Veo templates + queue transparency',
        body: 'Added Veo V2 routing, queue length indicator on Price-Before chip, and shared wallet notifications.',
      },
      {
        date: '2024-06-05',
        title: 'Refund automation',
        body: 'Automatic refunds now trigger within 90 seconds when renders fail or providers error out.',
      },
      {
        date: '2024-05-29',
        title: 'Brand kit hand-off',
        body: 'Workflows export brand kits into FCPXML and AE JSON for post teams.',
      },
    ],
  },
  status: {
    hero: {
      title: 'Status',
      subtitle: 'Live indicators for queue health, routing providers, and billing systems. Subscribe inside the app for incident alerts.',
    },
    systems: [
      { name: 'Engine routing', status: 'Operational', detail: 'All engines responding within SLA.' },
      { name: 'Queue processing', status: 'Operational', detail: 'Average start time under 45 seconds.' },
      { name: 'Wallet + billing', status: 'Operational', detail: 'Payments, refunds, and receipts running normally.' },
      { name: 'Callbacks & webhooks', status: 'Degraded', detail: 'Webhook retries delayed ~2 minutes. Investigating.' },
    ],
    incidents: [
      {
        date: '2024-06-10',
        title: 'Pika provider latency',
        summary: 'Pika queue delays for 34 minutes. Auto refunds triggered for impacted renders.',
        status: 'Resolved',
      },
    ],
  },
  systemMessages: {
    refundInitiated: 'Your payment is being refunded. It can take 5–10 business days to appear on your statement.',
    partialRefund: 'We’ve issued a partial refund of {refundedAmount}. The remaining {remainingAmount} will stay on your statement.',
    paymentRetried: 'We’ve safely retried your payment; you will not be double-charged.',
  },
};

const fr: Dictionary = en;

const dictionaries: Record<Locale, Dictionary> = { en, fr };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}

export type { Dictionary };
