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
    items: Array<{ title: string; engine: string; description: string; alt: string }>;
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
      'Independent hub for professional AI video — price before you generate, stay on the latest engines, one workspace for every shot. Works with Veo, Luma, Pika, Runway, Kling, and more. Trademarks belong to their owners.',
    languageLabel: 'Language',
    languages: [
      { locale: 'en', label: 'English' },
      { locale: 'fr', label: 'Français' },
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
      brands: ['Veo', 'Luma', 'Pika', 'Runway', 'Kling'],
      caption: 'Independent hub. Trademarks belong to their owners.',
      availabilityNotice: 'Availability may vary. Some models are in limited access or waitlist.',
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
        body: 'Run Veo, Luma, Pika, Runway, Kling, and rotating betas without switching platforms.',
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
          id: 'runway-brand',
          label: 'Runway · Brand explainer',
          description: 'Upscaled 4K storyboard with VO mixdown for the launch team.',
          alt: '4K brand explainer storyboard animated with Runway.',
          meta: {
            slug: 'runway-gen-3',
            pricing: { engineId: 'runwayg3', durationSec: 12, resolution: '1080p', memberTier: 'member' },
          },
        },
        {
          id: 'luma-product',
          label: 'Luma · Product hero',
          description: 'Photoreal tabletop hero loop routed through Dream Machine.',
          alt: 'Loop of a product hero turntable created with Luma.',
          meta: {
            slug: 'luma-dream-machine',
            pricing: { engineId: 'lumaDM', durationSec: 8, resolution: '1080p', memberTier: 'member' },
          },
        },
        {
          id: 'pika-social',
          label: 'Pika · Social cut',
          description: 'Punchy 9:16 social loop with captions and remix-ready motion.',
          alt: 'Vertical social loop with motion captions produced via Pika.',
          meta: {
            slug: 'pika-2-2',
            pricing: { engineId: 'pika22', durationSec: 6, resolution: '1080p', memberTier: 'member' },
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
        veo3: 'Filmic control for narratives and longer edits.',
        lumaDM: 'Photoreal product hero shots and tabletop detail.',
        pika22: 'Quick social loops with captions and remix-friendly settings.',
        runwayg3: 'Brand explainers, upscale workflows, and VO sync.',
        kling25: 'Beta animation previews with stylised motion.',
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
      title: 'Always the latest engines — no vendor lock-in.',
      subtitle:
        'MaxVideo AI routes each brief to the best-fit engine. Price Before chips stay accurate because we refresh versions as providers ship updates.',
    },
    availabilityLabels: {
      available: 'Available',
      limited: 'Limited access',
      waitlist: 'Waitlist',
      paused: 'Paused',
    },
    meta: {
      'google-veo-3': {
        displayName: 'Veo 3',
        description: 'Filmic controls for narrative spots and longer edits with Dolby Vision preview support.',
        priceBefore: 'Live cost chip with cinematic and fast queue tiers.',
        versionLabel: 'V3',
      },
      'google-veo-3-fast': {
        displayName: 'Veo 3 Fast',
        description: 'Faster queue for previz passes while keeping Veo’s cinematic look and audio support.',
        priceBefore: 'Chip compares cinematic vs fast queues before you route.',
        versionLabel: 'V3 Fast',
      },
      'luma-dream-machine': {
        displayName: 'Luma Dream Machine',
        description: 'Photoreal hero shots, tabletop, and hardware explainers with depth-aware moves.',
        priceBefore: 'Price Before surfaces photoreal vs stylised presets before you render.',
        versionLabel: 'Dream Machine',
      },
      'luma-dream-machine-fast': {
        displayName: 'Luma Dream Machine Fast',
        description: 'Quick iterations on Dream Machine looks with balanced detail for look-dev and storyboards.',
        priceBefore: 'Chip shows the fast queue rate versus full-quality before launch.',
        versionLabel: 'Dream Machine Fast',
      },
      'pika-2-2': {
        displayName: 'Pika 2.2',
        description: 'Social-first loops, caption overlays, and rapid iterations for remixing prompts.',
        priceBefore: 'Chip displays loop duration and caption add-on cost.',
        versionLabel: '2.2',
      },
      'pika-2-2-keyframes': {
        displayName: 'Pika 2.2 Keyframes',
        description: 'Guide motion across beats with 2–4 keyframes for directed social edits and animatics.',
        priceBefore: 'See keyframe surcharge and duration cost before you submit.',
        versionLabel: '2.2 Keyframes',
      },
      'runway-gen-3': {
        displayName: 'Runway Gen-3',
        description: 'Brand explainers, upscale workflows, and voiceover sync with caption burn-in.',
        priceBefore: 'Preview 1080p vs 4K cost before routing to the queue.',
        versionLabel: 'Gen-3',
      },
      'kling-2-5': {
        displayName: 'Kling 2.5',
        description: 'High-fidelity animation previews with stylised motion. Rotating beta slots updated weekly.',
        priceBefore: 'Beta pricing chip shows experimental rate before approval.',
        versionLabel: '2.5',
      },
      'kling-2-5-turbo': {
        displayName: 'Kling 2.5 Turbo',
        description: 'Turbo queue for animation look-dev—faster feedback before sending to full Kling renders.',
        priceBefore: 'Chip highlights turbo queue rate before you commit budget.',
        versionLabel: '2.5 Turbo',
      },
    },
    note:
      'Independent hub. Works with Veo, Luma, Pika, Runway, Kling, and rotating betas. Trademarks belong to their owners.',
  },
  examples: {
    hero: {
      title: 'Examples routed automatically.',
      subtitle: 'Hover to loop, click to expand. Every clip lists the engine we routed, the duration, and the deliverable format.',
    },
    items: [
      {
        title: 'Launch teaser',
        engine: 'Veo · 16:9 · 12s',
        description: 'Narrative lighting, upscale ready.',
        alt: 'Veo render of a cinematic brand launch teaser.',
        meta: {
          slug: 'google-veo-3',
          pricing: { engineId: 'veo3', durationSec: 12, resolution: '1080p', memberTier: 'member' },
        },
      },
      {
        title: 'Product hero',
        engine: 'Luma · 1:1 · 8s loop',
        description: 'Depth-aware turntable with captions.',
        alt: 'Luma clip showing a rotating product hero shot.',
        meta: {
          slug: 'luma-dream-machine',
          pricing: { engineId: 'lumaDM', durationSec: 8, resolution: '1080p', memberTier: 'member' },
        },
      },
      {
        title: 'Social cut',
        engine: 'Pika · 9:16 · 6s',
        description: 'Auto captions + VO mixdown.',
        alt: 'Pika vertical social cut with captions.',
        meta: {
          slug: 'pika-2-2',
          pricing: { engineId: 'pika22', durationSec: 6, resolution: '1080p', memberTier: 'member' },
        },
      },
      {
        title: 'Explainer',
        engine: 'Runway · 1080p · 18s',
        description: 'Brand kit palette and typography.',
        alt: 'Runway brand explainer frame with on-screen text.',
        meta: {
          slug: 'runway-gen-3',
          pricing: { engineId: 'runwayg3', durationSec: 18, resolution: '1080p', memberTier: 'member' },
        },
      },
      {
        title: 'Workflow hand-off',
        engine: 'Kling · 16:9 · 12s',
        description: 'Layered beta animation ready for AE JSON export.',
        alt: 'Kling animation preview ready for AE JSON export.',
        meta: {
          slug: 'kling-2-5',
          pricing: { engineId: 'kling25', durationSec: 12, resolution: '1080p', memberTier: 'member' },
        },
      },
      {
        title: 'Template remix',
        engine: 'Luma Fast · 9:16 · 8s',
        description: 'One prompt, multiple aspect ratios in the fast queue.',
        alt: 'Luma Dream Machine Fast outputs arranged in a grid.',
        meta: {
          slug: 'luma-dream-machine-fast',
          pricing: { engineId: 'lumaDM_fast', durationSec: 8, resolution: '1080p', memberTier: 'member' },
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
      'Independence matters: we stay neutral across engines, integrate with Veo, Luma, Pika, Runway, Kling, and rotating betas, and list trademarks only to describe compatibility.',
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

const fr: Dictionary = {
  ...en,
  nav: {
    brand: 'MaxVideo AI',
    links: [
      { key: 'models', href: '/models' },
      { key: 'examples', href: '/examples' },
      { key: 'pricing', href: '/pricing' },
      { key: 'workflows', href: '/workflows' },
      { key: 'docs', href: '/docs' },
    ],
    login: 'Connexion',
    cta: 'Créer une vidéo',
    linkLabels: {
      models: 'Moteurs',
      examples: 'Exemples',
      pricing: 'Tarifs',
      workflows: 'Workflows',
      docs: 'Docs',
    },
  },
  footer: {
    ...en.footer,
    brandNote:
      'Hub indépendant pour la vidéo IA professionnelle — calculez avant de générer, accédez aux derniers moteurs, un seul espace de travail pour chaque plan. Compatible Veo, Luma, Pika, Runway, Kling et plus encore. Les marques citées appartiennent à leurs propriétaires.',
    languageLabel: 'Langue',
    languages: [
      { locale: 'en', label: 'English' },
      { locale: 'fr', label: 'Français' },
    ],
  },
  home: {
    ...en.home,
    hero: {
      title: 'Le bon moteur pour chaque plan.',
      subtitle: 'Vidéo IA professionnelle sans friction. Calculez avant de générer. Un hub pour tout votre travail.',
      primaryCta: 'Créer une vidéo',
      secondaryCta: 'Voir le fonctionnement',
    },
    worksWith: {
      label: 'Compatible avec',
      brands: ['Veo', 'Luma', 'Pika', 'Runway', 'Kling'],
      caption: 'Hub indépendant. Les marques citées appartiennent à leurs propriétaires.',
      availabilityNotice: 'La disponibilité peut varier. Certains modèles sont en accès limité ou sur liste d’attente.',
    },
    waysSection: {
      title: 'Deux modes pour avancer.',
      subtitle: 'Changez de moteur en un clic, gardez la même plateforme.',
    },
    gallery: {
      ...en.home.gallery,
      title: 'Galerie',
      subtitle: 'Des rendus prêts pour les clients — survolez pour prévisualiser, cliquez pour agrandir.',
      caption: 'Modèle sélectionné automatiquement pour ce plan.',
      hoverLabel: 'Prévisualisation au survol',
      items: [
        {
          id: 'runway-brand',
          label: 'Runway · Vidéo marque',
          description: 'Storyboard 4K upscalé avec mixage voix-off pour le lancement.',
          alt: 'Storyboard animé en 4K réalisé avec Runway.',
          meta: {
            slug: 'runway-gen-3',
            pricing: { engineId: 'runwayg3', durationSec: 12, resolution: '1080p', memberTier: 'member' },
          },
        },
        {
          id: 'luma-product',
          label: 'Luma · Hero produit',
          description: 'Boucle produit photoréaliste générée avec Dream Machine.',
          alt: 'Boucle montrant un produit en rotation rendue avec Luma.',
          meta: {
            slug: 'luma-dream-machine',
            pricing: { engineId: 'lumaDM', durationSec: 8, resolution: '1080p', memberTier: 'member' },
          },
        },
        {
          id: 'pika-social',
          label: 'Pika · Cut social',
          description: 'Loop 9:16 dynamique avec légendes intégrées, prête à remixer.',
          alt: 'Loop verticale avec motion captions produite via Pika.',
          meta: {
            slug: 'pika-2-2',
            pricing: { engineId: 'pika22', durationSec: 6, resolution: '1080p', memberTier: 'member' },
          },
        },
      ],
    },
    pricing: {
      badge: 'Mise en avant tarifaire',
      title: 'Calculez avant de générer.',
      body: 'Payez uniquement ce que vous exécutez. Démarrez avec les Starter Credits (5 $). Aucun abonnement. Aucun engagement.',
      link: 'Voir les tarifs',
    },
    trust: {
      badge: 'Confiance & sécurité',
      points: [
        'Hub indépendant. Aucun verrou fournisseur.',
        'Filtres de sécurité renforcés et escalade humaine sur les prompts sensibles.',
        'Remboursements en cas d’échec. Reçus détaillés pour chaque rendu.',
        'Compatible avec les principaux moteurs ; les marques appartiennent à leurs propriétaires.',
      ],
    },
    priceChipSuffix: 'Calculez avant de générer.',
    priceChipPrefix: 'Ce rendu',
  },
  pricing: {
    ...en.pricing,
    hero: {
      title: 'Calculez avant de générer. Payez uniquement ce que vous lancez. Démarrez avec 5 $ de crédits. Aucun abonnement.',
      subtitle:
        'Les estimations se mettent à jour en temps réel selon le moteur, la durée et les sorties. Les portefeuilles d’équipe se synchronisent quotidiennement.',
    },
    estimator: {
      ...en.pricing.estimator,
      walletLink: 'Besoin d’un calculateur public ?',
      walletLinkCta: 'Ouvrir le calculateur',
      chargedNote: 'Facturé uniquement si le rendu aboutit.',
      fields: {
        engine: 'Moteur',
        resolution: 'Résolution',
        duration: 'Durée (secondes)',
        memberStatus: 'Statut membre',
      },
      estimateLabels: {
        heading: 'Estimation',
        base: 'Base',
        discount: 'Remise',
        memberChipPrefix: 'Tarif membre — Vous économisez',
      },
      descriptions: {
        veo3: 'Contrôle filmique pour les narrations et montages longs.',
        lumaDM: 'Rendus produit photoréalistes et plans table-top.',
        pika22: 'Boucles sociales rapides avec légendes et remix.',
        runwayg3: 'Explainers de marque, upscale et synchronisation VO.',
        kling25: 'Prévisualisations animées stylisées en bêta.',
      },
      engineRateLabel: 'Tarif moteur',
      durationLabel: 'Durée',
      resolutionLabel: 'Résolution',
    },
    wallet: {
      ...en.pricing.wallet,
      description:
        'Alimentez votre portefeuille avec 5 $ de crédits ou ajoutez 5 / 10 / 25 $ quand vous en avez besoin. L’auto rechargement garde vos rendus en file.',
      balanceLabel: 'Solde du portefeuille',
      balanceHelper: 'Les Starter Credits commencent à 5 $. Le portefeuille partagé se synchronise pour toute l’équipe.',
      autoTopUpLabel: 'Recharge automatique sous 10 $',
      autoTopUpHint: 'Un email quotidien informe la finance.',
      addLabel: 'Ajouter {amount} $',
    },
    refunds: {
      title: 'Remboursements & protections',
      points: [
        'Remboursements automatiques lorsque les rendus échouent ou que les fournisseurs dépassent le SLA.',
        'Reçus détaillant moteur, durée, résolution et add-ons.',
        'Protections du portefeuille avec validation multi-approbateur en option.',
        'Les frais de plateforme sont reconnus immédiatement ; la part fournisseur est versée lors du payout.',
        'Chaque tentative de rendu transporte une clé d’idempotence pour éviter les doubles débits.',
      ],
    },
    teams: {
      ...en.pricing.teams,
      description:
        'Portefeuille partagé et rôles pour aligner finance, producteurs et parties prenantes dans un même espace.',
    },
    member: {
      ...en.pricing.member,
      title: 'Statut membre',
      subtitle:
        'Mise à jour quotidienne selon vos 30 derniers jours de dépenses. Pastilles : “Tarif membre — Vous économisez 5 % / 10 %.” Aucun abonnement requis.',
      tiers: [
        {
          name: 'Membre',
          requirement: 'Statut par défaut',
          benefit: 'Tarif standard. Pastille “Tarif membre”.',
        },
        {
          name: 'Plus',
          requirement: '≥ 50 $ sur 30 jours glissants',
          benefit: 'Vous économisez 5 %. Styles enregistrés illimités.',
        },
        {
          name: 'Pro',
          requirement: '≥ 200 $ sur 30 jours glissants',
          benefit: 'Vous économisez 10 %. Accès anticipé et file prioritaire.',
        },
      ],
      chipBase: 'Tarif membre — Vous économisez',
      tooltip: 'Mise à jour quotidienne selon vos 30 derniers jours de dépenses.',
    },
    faq: {
      title: 'Micro-FAQ',
      entries: [
        {
          question: 'Comment fonctionnent les crédits ?',
          answer: 'Les Starter Credits ajoutent 5 $ à votre portefeuille. Vous les utilisez comme du cash puis rechargez quand vous en avez besoin.',
        },
        {
          question: 'Ont-ils une date d’expiration ?',
          answer: 'Non. Le solde ne périme pas et reste partagé avec toute l’équipe d’un mois à l’autre.',
        },
        {
          question: 'Que se passe-t-il si un rendu échoue ?',
          answer: 'Les rendus échoués sont remboursés automatiquement en quelques minutes. Vous ne payez que les réussites.',
        },
        {
          question: 'Quelles sont les remises membre ?',
          answer: '50 $ dépensés sur 30 jours = -5 %, 200 $ = -10 %. Les remises s’appliquent automatiquement sur chaque rendu admissible.',
        },
      ],
    },
    priceChipSuffix: 'Calculez avant de générer.',
  },
  calculator: {
    hero: {
      title: 'Estimez votre coût vidéo IA avant de générer.',
      subtitle:
        'Ce calculateur public reflète l’outil interne MaxVideo AI. Choisissez moteur, durée et résolution pour voir le montant sans connexion.',
    },
    lite: {
      title: 'Calculateur allégé',
      subtitle: 'Parfait pour les parties prenantes qui veulent un chiffrage rapide avant de partager prompts ou assets.',
      footer: 'Prêt à lancer le rendu ? {link} pour alimenter votre portefeuille et générer dans l’espace de travail.',
      footerLinkText: 'Voir les tarifs',
    },
  },
  workflows: {
    ...en.workflows,
    hero: {
      title: 'Express ou Workflows.',
      subtitle:
        'Express accélère vos tests. Workflows aligne les équipes marque avec validations, kits créa, intégrations Drive/Dropbox/OneDrive/S3 et contrôle budgets.',
    },
    express: {
      ...en.workflows.express,
      title: 'Des clips prêts à publier en quelques minutes.',
    },
    workflows: {
      ...en.workflows.workflows,
      title: 'Un transfert complet pour les équipes marque et post-production.',
    },
  },
  models: {
    ...en.models,
    hero: {
      title: 'Toujours les moteurs les plus récents — sans verrou fournisseur.',
      subtitle:
        'MaxVideo AI route chaque brief vers le moteur idéal. Les pastilles tarifaires restent justes car nous mettons à jour les versions dès qu’elles sortent.',
    },
    availabilityLabels: {
      available: 'Disponible',
      limited: 'Accès limité',
      waitlist: 'Liste d’attente',
      paused: 'Suspendu',
    },
    meta: {
      'google-veo-3': {
        displayName: 'Veo 3',
        description: 'Contrôle filmique pour les spots narratifs et montages longs, avec prévisualisation Dolby Vision.',
        priceBefore: 'Pastille live avec file cinématographique et file rapide.',
        versionLabel: 'V3',
      },
      'google-veo-3-fast': {
        displayName: 'Veo 3 Fast',
        description: 'File accélérée pour les prévisualisations tout en conservant le rendu cinéma et l’audio.',
        priceBefore: 'La pastille compare file cinéma vs fast avant lancement.',
        versionLabel: 'V3 Fast',
      },
      'luma-dream-machine': {
        displayName: 'Luma Dream Machine',
        description: 'Plans produit photoréalistes, tabletop et explainers hardware avec mouvements depth-aware.',
        priceBefore: 'Price Before distingue photoréaliste vs stylisé avant rendu.',
        versionLabel: 'Dream Machine',
      },
      'luma-dream-machine-fast': {
        displayName: 'Luma Dream Machine Fast',
        description: 'Itérations rapides des looks Dream Machine pour look-dev et storyboards.',
        priceBefore: 'La pastille indique le tarif fast vs qualité complète avant mise en file.',
        versionLabel: 'Dream Machine Fast',
      },
      'pika-2-2': {
        displayName: 'Pika 2.2',
        description: 'Boucles social-first, overlays de légendes et itérations express pour remix de prompts.',
        priceBefore: 'La pastille affiche la durée de boucle et l’option légendes.',
        versionLabel: '2.2',
      },
      'pika-2-2-keyframes': {
        displayName: 'Pika 2.2 Keyframes',
        description: 'Contrôlez le mouvement avec 2 à 4 keyframes pour montages sociaux dirigés et animatics.',
        priceBefore: 'Voir le surcoût keyframes et la durée avant de lancer.',
        versionLabel: '2.2 Keyframes',
      },
      'runway-gen-3': {
        displayName: 'Runway Gen-3',
        description: 'Explainers de marque, upscale et synchro voix-off avec sous-titres intégrés.',
        priceBefore: 'Anticipez le coût 1080p vs 4K avant mise en file.',
        versionLabel: 'Gen-3',
      },
      'kling-2-5': {
        displayName: 'Kling 2.5',
        description: 'Prévisualisations animées haute fidélité avec motion stylisé. Slots beta tournants.',
        priceBefore: 'La pastille beta montre le tarif expérimental avant validation.',
        versionLabel: '2.5',
      },
      'kling-2-5-turbo': {
        displayName: 'Kling 2.5 Turbo',
        description: 'File turbo pour look-dev animation — feedback rapide avant Kling complet.',
        priceBefore: 'La pastille indique le tarif turbo avant engagement budget.',
        versionLabel: '2.5 Turbo',
      },
    },
    note:
      'Hub indépendant. Compatible avec Veo, Luma, Pika, Runway, Kling et les bêtas tournantes. Les marques appartiennent à leurs propriétaires.',
  },
  examples: {
    ...en.examples,
    hero: {
      title: 'Exemples routés automatiquement.',
      subtitle:
        'Survolez pour lire en boucle, cliquez pour agrandir. Chaque clip affiche le moteur, la durée et le format livré.',
    },
    items: [
      {
        title: 'Teaser lancement',
        engine: 'Veo · 16:9 · 12s',
        description: 'Éclairage narratif, prêt pour l’upscale.',
        alt: 'Rendu Veo d’un teaser de lancement cinématographique.',
        meta: {
          slug: 'google-veo-3',
          pricing: { engineId: 'veo3', durationSec: 12, resolution: '1080p', memberTier: 'member' },
        },
      },
      {
        title: 'Hero produit',
        engine: 'Luma · 1:1 · boucle 8s',
        description: 'Turntable photoréaliste avec sous-titres.',
        alt: 'Clip Luma montrant un produit en rotation.',
        meta: {
          slug: 'luma-dream-machine',
          pricing: { engineId: 'lumaDM', durationSec: 8, resolution: '1080p', memberTier: 'member' },
        },
      },
      {
        title: 'Cut social',
        engine: 'Pika · 9:16 · 6s',
        description: 'Légendes auto + mixage voix-off.',
        alt: 'Cut vertical Pika avec légendes.',
        meta: {
          slug: 'pika-2-2',
          pricing: { engineId: 'pika22', durationSec: 6, resolution: '1080p', memberTier: 'member' },
        },
      },
      {
        title: 'Explainer',
        engine: 'Runway · 1080p · 18s',
        description: 'Palette et typo issues du brand kit.',
        alt: 'Frame d’un explainer Runway avec texte incrusté.',
        meta: {
          slug: 'runway-gen-3',
          pricing: { engineId: 'runwayg3', durationSec: 18, resolution: '1080p', memberTier: 'member' },
        },
      },
      {
        title: 'Handoff workflow',
        engine: 'Kling · 16:9 · 12s',
        description: 'Fichiers animés prêts pour export AE JSON.',
        alt: 'Prévisualisation Kling prête pour export AE JSON.',
        meta: {
          slug: 'kling-2-5',
          pricing: { engineId: 'kling25', durationSec: 12, resolution: '1080p', memberTier: 'member' },
        },
      },
      {
        title: 'Remix template',
        engine: 'Luma Fast · 9:16 · 8s',
        description: 'Un prompt, plusieurs ratios en file rapide.',
        alt: 'Variantes Luma Dream Machine Fast sur une grille.',
        meta: {
          slug: 'luma-dream-machine-fast',
          pricing: { engineId: 'lumaDM_fast', durationSec: 8, resolution: '1080p', memberTier: 'member' },
        },
      },
    ],
    cta: 'Générer une vidéo similaire',
  },
  docs: {
    ...en.docs,
    hero: {
      title: 'Documentation',
      subtitle:
        'Point de départ pour l’onboarding, la sécurité de marque, les compatibilités et la politique de remboursement. Les guides avancés sont dans l’espace authentifié.',
    },
    empty: 'Documentation à venir.',
    libraryHeading: 'Bibliothèque',
  },
  blog: {
    ...en.blog,
    hero: {
      title: 'Le blog MaxVideo AI.',
      subtitle:
        'Actualités moteurs, retours clients, guides prompt et bonnes pratiques price-before. Abonnez-vous dans l’app pour recevoir les mises à jour.',
    },
    empty: 'Articles à venir.',
    cta: 'Lire la suite',
  },
  about: {
    ...en.about,
    hero: {
      title: 'La confiance tranquille des équipes vidéo IA.',
      subtitle:
        'MaxVideo AI est le hub indépendant pour la production vidéo IA. Nous choisissons le bon moteur, affichons le prix avant de générer et gardons votre équipe aux commandes.',
    },
    paragraphs: [
      'Nous pensons que les équipes pro méritent de la clarté avant de lancer un rendu : transparence tarifaire, routage fiable et contexte partagé entre créatifs, production et parties prenantes.',
      'L’indépendance est essentielle : nous restons neutres vis-à-vis des moteurs, intégrons Veo, Luma, Pika, Runway, Kling et les bêtas, et ne citons les marques que pour indiquer la compatibilité.',
      'Le produit est conçu pour la précision sans bruit : interface discrète, réglages premium, contrôle minutieux et pastilles tarifaires qui incluent la finance.',
    ],
    note:
      'Les marques et services cités restent la propriété de leurs détenteurs. MaxVideo AI demeure indépendant pour vous laisser suivre le rythme sans changer de plateforme.',
  },
  contact: {
    ...en.contact,
    hero: {
      title: 'Contacter l’équipe.',
      subtitle: 'Besoin de support, d’un onboarding entreprise ou d’informations presse ? Écrivez-nous et nous répondons sous un jour ouvré.',
    },
    form: {
      ...en.contact.form,
      name: 'Nom',
      email: 'Email',
      topic: 'Sujet',
      selectPlaceholder: 'Choisissez un sujet',
      message: 'Message',
      submit: 'Envoyer',
      alt: 'Préférez l’email ? {email}.',
    },
  },
  legal: {
    terms: {
      title: 'Conditions d’utilisation',
      intro: 'Aperçu provisoire en attendant la version juridique finale. Contactez legal@maxvideo.ai pour toute question.',
      sections: en.legal.terms.sections.map((section) => section),
    },
    privacy: {
      title: 'Politique de confidentialité',
      intro: 'Résumé de nos pratiques de confidentialité. La version légale complète sera publiée ici.',
      sections: en.legal.privacy.sections.map((section) => section),
    },
  },
  changelog: {
    ...en.changelog,
    hero: {
      title: 'Journal des mises à jour',
      subtitle:
        'Chaque évolution moteur, amélioration workflow ou ajustement tarifaire — publié chaque semaine. Abonnez-vous depuis l’app pour recevoir les alertes.',
    },
  },
  status: {
    ...en.status,
    hero: {
      title: 'Statut',
      subtitle:
        'Statut en direct des files d’attente, des fournisseurs et de la facturation. Abonnez-vous dans l’app pour être alerté des incidents.',
    },
    systems: [
      { name: 'Routage des moteurs', status: 'Opérationnel', detail: 'Tous les moteurs répondent dans le SLA.' },
      { name: 'Traitement de file', status: 'Opérationnel', detail: 'Temps de démarrage moyen inférieur à 45 secondes.' },
      { name: 'Portefeuille & facturation', status: 'Opérationnel', detail: 'Paiements, remboursements et reçus fonctionnent normalement.' },
      { name: 'Callbacks & webhooks', status: 'Dégradé', detail: 'Reprises de webhooks retardées d’environ 2 minutes. Enquête en cours.' },
    ],
    incidents: [
      {
        date: '2024-06-10',
        title: 'Latence fournisseur Pika',
        summary: 'Retards de file Pika pendant 34 minutes. Remboursements automatiques pour les rendus impactés.',
        status: 'Résolu',
      },
    ],
  },
  systemMessages: {
    refundInitiated: 'Votre paiement est en cours de remboursement. Comptez 5 à 10 jours ouvrés pour le voir sur votre relevé.',
    partialRefund: 'Nous avons remboursé {refundedAmount}. Le solde restant ({remainingAmount}) restera visible sur votre relevé.',
    paymentRetried: 'Nous avons relancé votre paiement en toute sécurité ; aucun double débit ne sera appliqué.',
  },
};

const dictionaries: Record<Locale, Dictionary> = { en, fr };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}

export type { Dictionary };
