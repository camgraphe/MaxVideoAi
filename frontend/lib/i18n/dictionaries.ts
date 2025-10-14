import type { PricingScenario } from '@/lib/pricing-scenarios';

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
    proofTabs: Array<{ id: string; label: string; heading: string; body: string }>;
    whyCards: Array<{ title: string; body: string }>;
    ways: Array<{ title: string; description: string; bullets: string[] }>;
    waysSection: { title: string; subtitle: string };
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
    availabilityLabels: Record<'available' | 'limited' | 'waitlist' | 'paused', string>;
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
    ],
    login: 'Log in',
    cta: 'Create a video',
    linkLabels: {
      models: 'Models',
      examples: 'Examples',
      pricing: 'Pricing',
      workflows: 'Workflows',
      docs: 'Docs',
    },
  },
  footer: {
    links: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Docs', href: '/docs' },
      { label: 'Support', href: '/contact' },
    ],
    brandNote:
      'Independent hub for professional AI video — price before you generate, stay on the latest engines, one workspace for every shot. Works with Sora, Veo, Luma, Pika, MiniMax, Hunyuan, and more. Trademarks belong to their owners.',
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
      primaryCta: 'Create a video',
      secondaryCta: 'See how it works',
    },
    worksWith: {
      label: 'Works with',
      brands: ['Veo', 'Sora', 'Luma', 'Pika', 'MiniMax'],
      caption: 'Independent hub. Trademarks belong to their owners.',
      availabilityNotice: 'Availability may vary by provider; pricing chips refresh automatically.',
    },
    proofTabs: [
      {
        id: 'brief',
        label: 'Brief',
        heading: 'Describe goal & tone → Prompt Director assists.',
        body: 'Capture the shot once. Prompt Director applies tone, brand guardrails, and suggests the right engine based on budget.',
      },
      {
        id: 'price',
        label: 'Price Before',
        heading: 'Choose engine / duration / resolution → see cost chip.',
        body: 'Preview wallet impact before running the job. Swap engines without losing your brief. Charged only if the render succeeds.',
      },
      {
        id: 'outputs',
        label: 'Outputs',
        heading: 'Approve best take → export formats.',
        body: 'Lock the take, apply brand kits, and export clips, captions, VO, or project files for post teams.',
      },
    ],
    whyCards: [
      {
        title: 'Pro results without the model mess.',
        body: 'Stay focused on the shot. We handle routing, updates, and guardrails so the right engine runs every time.',
      },
      {
        title: 'Price before you generate.',
        body: 'Every render shows an upfront cost chip. You only pay when the job succeeds.',
      },
      {
        title: 'Always the latest engines (no vendor lock-in).',
        body: 'Run Sora, Veo, Luma, Pika, MiniMax, and rotating betas without switching platforms.',
      },
    ],
    ways: [
      {
        title: 'Express — Publish in minutes.',
        description: 'Templates cover shorts, motion captions, and auto VO. Export every social ratio in one run.',
        bullets: ['Template prompts ready to remix', 'Caption + VO mixdown optional', 'Auto 16:9, 1:1, 9:16 crops'],
      },
      {
        title: 'Workflows — Plug into your process.',
        description: 'Full creative control with brand kits, approvals, and delivery hand-offs for Drive, Dropbox, OneDrive, or S3.',
        bullets: ['Brand kits + Saved Styles', 'Approvals, comments, and version lock', 'Optional FCPXML / AE JSON hand-off'],
      },
    ],
    waysSection: {
      title: 'Two ways to use it.',
      subtitle: 'Switch engines fast. Not platforms.',
    },
    gallery: {
      title: 'Gallery',
      subtitle: 'Real client-ready outputs — hover to preview, tap to expand.',
      caption: 'Model routed for this shot.',
      hoverLabel: 'Hover loop preview',
      items: [
        {
          id: 'veo-teaser',
          label: 'Veo 3 · Launch teaser',
          description: 'Narrative lighting with audio on for the campaign reveal.',
          alt: 'Google Veo 3 cinematic teaser.',
          meta: {
            slug: 'google-veo-3',
            pricing: { engineId: 'veo3', durationSec: 12, resolution: '1080p', memberTier: 'member' },
          },
        },
        {
          id: 'luma-ray2',
          label: 'Luma Ray 2 Flash · Product hero',
          description: 'Depth-aware turntable routed through Ray 2 Flash for quick approvals.',
          alt: 'Luma Ray 2 Flash product hero loop.',
          meta: {
            slug: 'luma-ray-2-flash',
            pricing: { engineId: 'lumaRay2_flash', durationSec: 8, resolution: '720p', memberTier: 'member' },
          },
        },
        {
          id: 'minimax-concept',
          label: 'MiniMax · Concept draft',
          description: 'Camera-tag animation for director boards before the hero pass.',
          alt: 'MiniMax Video 01 concept animation.',
          meta: {
            slug: 'minimax-video-01',
            pricing: { engineId: 'minimax_video_01', durationSec: 6, resolution: '720p', memberTier: 'member' },
          },
        },
      ],
    },
    pricing: {
      badge: 'Pricing callout',
      title: 'Price before you generate.',
      body: 'Pay only for what you run. Start with Starter Credits ($5). No subscription. No lock-in.',
      link: 'See pricing',
    },
    trust: {
      badge: 'Trust & safety',
      points: [
        'Independent hub. No vendor lock-in.',
        'Brand-safe filters plus human escalation for sensitive prompts.',
        'Refunds on failed renders. Itemised receipts for every job.',
        'Works with leading engines; trademarks belong to their owners.',
      ],
    },
    priceChipSuffix: 'Price before you generate.',
  },
  pricing: {
    hero: {
      title: 'Price before you generate. Pay only for what you run. Start with Starter Credits ($5). No subscription. No lock-in.',
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
        'sora-2': 'Text/image/video remix with native audio.',
        veo3: 'Filmic control for narratives and longer edits.',
        lumaDM: 'Photoreal product shots and tabletop detail.',
        pika22: 'Quick social loops with captions and remix-friendly settings.',
        minimax_video_01: 'Camera-tag animation drafts for concept boards.',
      },
      engineRateLabel: 'Engine rate',
      durationLabel: 'Duration',
      resolutionLabel: 'Resolution',
    },
    wallet: {
      title: 'Wallet',
      description: 'Fund your wallet with Starter Credits ($5) or add $5 / $10 / $25 at a time. Optional auto top-up keeps renders moving.',
      points: [
        'Starter Credits ($5) to get rolling instantly.',
        'Add funds in $5, $10, or $25 increments when you need them.',
        'Optional auto top-up with alerts when balance drops below your threshold.',
      ],
      balanceLabel: 'Wallet balance',
      balanceHelper: 'Starter Credits begin at $5. Shared wallets sync automatically.',
      autoTopUpLabel: 'Auto top-up when balance dips below $10',
      autoTopUpHint: 'Daily status emails keep finance in the loop.',
      addLabel: 'Add ${amount}',
    },
    teams: {
      title: 'Teams',
      description: 'Shared wallets and roles keep finance, producers, and stakeholders aligned in one workspace.',
      points: [
        'Shared wallets with roles for producers, finance, and reviewers.',
        'Daily summaries call out spend, refunds, and queued renders.',
        'Approval trails keep budgets aligned with stakeholders.',
      ],
    },
    member: {
      title: 'Member status',
      subtitle: 'Status updates daily based on your rolling 30-day spend. Chips read “Member price — You save 5% / 10%.” No subscription required.',
      tiers: [
        {
          name: 'Member',
          requirement: 'Default status',
          benefit: 'Standard pricing. Chip reads “Member price”.',
        },
        {
          name: 'Plus',
          requirement: '≥ $50 in rolling 30 days',
          benefit: 'You save 5%. Unlimited Saved Styles for the workspace.',
        },
        {
          name: 'Pro',
          requirement: '≥ $200 in rolling 30 days',
          benefit: 'You save 10%. Early access to new engines + light queue boost.',
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
          answer: 'Starter Credits load $5 into your wallet. Spend them like cash and top up whenever you need more runs.',
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
        'Express handles rapid experimentation. Workflows keeps brand teams aligned with approvals, brand kits, Drive/Dropbox/OneDrive/S3 delivery, and budget controls.',
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
        'Brand kits: palettes, fonts, legal copy, saved styles',
        'Approvals: assign reviewers, comment on renders, lock versions',
        'Delivery: Drive, Dropbox, OneDrive, S3, plus optional FCPXML or AE JSON hand-off',
        'Budget controls: multi-approver spend limits and daily summaries',
      ],
    },
  },
  models: {
    hero: {
      title: 'Fal.ai engines without the vendor lock-in.',
      subtitle:
        'Fal.ai ships new video endpoints weekly. We sync their catalog so your Price Before chip stays accurate across Sora, Veo, Luma, Pika, MiniMax, and Hunyuan.',
    },
    availabilityLabels: {
      available: 'Available',
      limited: 'Limited access',
      waitlist: 'Waitlist',
      paused: 'Paused',
    },
    meta: {
      'openai-sora-2': {
        displayName: 'OpenAI Sora 2',
        description: 'Base Sora endpoints for text-to-video, remix, and audio-on renders via Fal routing.',
        priceBefore: '$0.10/s via Fal, with a badge when you bring your own OpenAI key.',
        versionLabel: 'v2',
      },
      'openai-sora-2-pro': {
        displayName: 'OpenAI Sora 2 Pro',
        description: 'Unlocks 1080p output and higher throughput while keeping native audio.',
        priceBefore: '$0.30/s (720p) and $0.50/s (1080p) surfaced before you queue.',
        versionLabel: 'v2 Pro',
      },
      'google-veo-3': {
        displayName: 'Google Veo 3',
        description: 'Cinematic realism with lip-sync and Dolby Vision previews.',
        priceBefore: '$0.50/s audio off or $0.75/s audio on highlighted ahead of launch.',
        versionLabel: 'Veo 3',
      },
      'google-veo-3-fast': {
        displayName: 'Google Veo 3 Fast',
        description: 'Faster queue for previz while keeping the Veo look and audio toggle.',
        priceBefore: '$0.25/s audio off or $0.40/s audio on in the chip.',
        versionLabel: 'Veo 3 Fast',
      },
      'kling-25-turbo-pro': {
        displayName: 'Kling 2.5 Turbo Pro',
        description: 'Stylised animation drafts with improved camera control.',
        priceBefore: 'Fal turbo queue rate surfaced before you spend budget.',
        versionLabel: '2.5 Turbo Pro',
      },
      'luma-dream-machine': {
        displayName: 'Luma Dream Machine v1.5',
        description: 'Photoreal hero loops, tabletop explainers, and depth-aware motion.',
        priceBefore: '$0.50/video (I2V) chip shown before you route.',
        versionLabel: 'Dream Machine 1.5',
      },
      'luma-ray-2': {
        displayName: 'Luma Ray 2',
        description: 'Higher-fidelity Luma Ray family for flagship hero shots.',
        priceBefore: 'Standard Ray 2 queue cost surfaced pre-run.',
        versionLabel: 'Ray 2',
      },
      'luma-ray-2-flash': {
        displayName: 'Luma Ray 2 Flash',
        description: 'Fast Ray 2 queue for storyboards and look-dev passes.',
        priceBefore: '$0.35/video Flash rate highlighted before submission.',
        versionLabel: 'Ray 2 Flash',
      },
      'pika-2-2': {
        displayName: 'Pika 2.2',
        description: 'Social loops with caption overlays and Pikascenes motion controls.',
        priceBefore: 'Chip compares 720p vs 1080p cost before you remix.',
        versionLabel: '2.2',
      },
      'minimax-video-01': {
        displayName: 'MiniMax Video 01',
        description: 'Camera-tag driven I2V/T2V for concept boards and Live2D-style motion.',
        priceBefore: '$0.50/video surfaced before you lock the prompt.',
        versionLabel: 'Video 01',
      },
      'minimax-hailuo-02-pro': {
        displayName: 'MiniMax Hailuo 02 Pro',
        description: '1080p image-to-video with higher fidelity output for hero shots.',
        priceBefore: '$0.08/s (6 s = $0.48) shown ahead of launch.',
        versionLabel: 'Hailuo 02 Pro',
      },
      'hunyuan-video': {
        displayName: 'Hunyuan Video',
        description: 'Tencent’s open model with Pro mode for longer and cleaner runs.',
        priceBefore: '$0.40/video with a Pro multiplier badge in the chip.',
        versionLabel: 'Hunyuan',
      },
    },
    note:
      'Pricing and availability pulled from Fal.ai model pages (Oct 2025). Trademarks belong to their owners.',
  },
  examples: {
    hero: {
      title: 'Examples routed automatically.',
      subtitle: 'Hover to loop, click to expand. Every clip lists the engine we routed, the duration, and the deliverable format.',
    },
    items: [
      {
        title: 'Launch teaser',
        engine: 'Veo 3 · 16:9 · 12s',
        description: 'Cinematic realism with native audio switched on.',
        alt: 'Google Veo 3 cinematic teaser frame.',
        meta: {
          slug: 'google-veo-3',
          pricing: { engineId: 'veo3', durationSec: 12, resolution: '1080p', memberTier: 'member' },
        },
      },
      {
        title: 'Product hero',
        engine: 'Luma Ray 2 Flash · 1:1 · 8s loop',
        description: 'Depth-aware turntable ready for social cutdowns.',
        alt: 'Luma Ray 2 Flash product hero loop.',
        meta: {
          slug: 'luma-ray-2-flash',
          pricing: { engineId: 'lumaRay2_flash', durationSec: 8, resolution: '720p', memberTier: 'member' },
        },
      },
      {
        title: 'Storyboard pass',
        engine: 'Kling 2.5 Turbo Pro · 16:9 · 10s',
        description: 'Stylised beta animation for motion approvals.',
        alt: 'Kling 2.5 Turbo Pro storyboard preview.',
        meta: {
          slug: 'kling-25-turbo-pro',
          pricing: { engineId: 'kling25_turbo_pro', durationSec: 10, resolution: '1080p', memberTier: 'member' },
        },
      },
      {
        title: 'Concept draft',
        engine: 'MiniMax Video 01 · 16:9 · 6s',
        description: 'Camera-tag I2V concept mix before hero render.',
        alt: 'MiniMax Video 01 concept frames.',
        meta: {
          slug: 'minimax-video-01',
          pricing: { engineId: 'minimax_video_01', durationSec: 6, resolution: '720p', memberTier: 'member' },
        },
      },
      {
        title: 'Social cut',
        engine: 'Pika 2.2 · 9:16 · 6s',
        description: 'Auto captions and motion accents for vertical drops.',
        alt: 'Pika 2.2 vertical social cut with captions.',
        meta: {
          slug: 'pika-2-2',
          pricing: { engineId: 'pika22', durationSec: 6, resolution: '1080p', memberTier: 'member' },
        },
      },
      {
        title: 'Pro mode render',
        engine: 'Hunyuan Video · 16:9 · 5s',
        description: 'Open-source realism with Pro mode enabled.',
        alt: 'Hunyuan Video output showcasing lighting and motion.',
        meta: {
          slug: 'hunyuan-video',
          pricing: { engineId: 'hunyuan_video', durationSec: 5, resolution: '720p', memberTier: 'member' },
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
          'Complete the brand brief to unlock Prompt Director, Saved Styles, and routing hints.',
          'Share context, tone, and deliverable requirements so every teammate is aligned before rendering.',
        ],
      },
      {
        title: 'Price system',
        items: [
          'Use the estimator to preview costs per engine. Chips display duration, resolution, and discounts.',
          'Starter Credits ($5) and rolling Member status (Member / Plus / Pro) update daily.',
        ],
      },
      {
        title: 'Refunds',
        items: [
          'Failed renders auto-refund in under two minutes with an incident note.',
          'Itemised receipts include render IDs for finance hand-off.',
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
          'Layered filters across prompts, media uploads, and outputs guard against policy breaches.',
          'Sensitive terms route to human review with audit logs and escalation options.',
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
      'Independence matters: we stay neutral across engines, integrate with Sora, Veo, Luma, Pika, MiniMax, Hunyuan, and rotating betas, and list trademarks only to describe compatibility.',
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
