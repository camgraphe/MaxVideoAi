import type { BestForCtaCopy, HubCopy } from './ai-video-engines-copy-types';

export const EN_HUB_COPY: HubCopy = {
    hero: {
      eyebrow: 'Compare engines',
      title: 'Compare AI video engines',
      intro:
        'Pick any two engines and open a side-by-side comparison in one click. Use this hub to scan popular matchups, filter by key limits, and validate pricing before you generate. It covers text-to-video, image-to-video, and video-to-video engines, then routes you to the right fit for your shot.',
      compareNow: {
        left: 'Engine A',
        right: 'Engine B',
        compare: 'Compare engines',
        searchPlaceholder: 'Search engine...',
        noResults: 'No results',
        strengthsLabel: 'Strengths',
        strengthsFallback: 'General purpose video',
        modeLabels: {
          t2v: 'Text-to-video',
          i2v: 'Image-to-video',
          v2v: 'Video-to-video',
        },
      },
    },
    sections: {
      popularTitle: 'Popular comparisons',
      popularIntro: 'A balanced shortlist of frequently requested matchups across the main engine families.',
      useCasesTitle: 'Compare by use case',
      useCasesIntro: 'Pick a goal and open one of the recommended matchups.',
      enginesTitle: 'Pick an engine to compare',
      enginesIntro: 'Compare-focused specs only. Full model guidance stays on each model page.',
      enginesToggle: 'Show engine catalog ({count})',
      enginesToggleHintClosed: 'Click to expand',
      enginesToggleHintOpen: 'Click to collapse',
      allComparisonsTitle: 'All comparisons',
      allComparisonsIntro:
        'Browse strategic matchups first, then search the full canonical catalog. Need policy details? Read our compliance notes.',
      faqTitle: 'AI video engine comparison FAQ',
      complianceLabel: 'Read compliance details',
      quickStartLabel: 'Quick start',
      prelaunchSpotlightLabel: 'Pre-launch spotlight',
      prelaunchModelLabel: 'Seedance 2.0 profile',
      prelaunchCompareLabel: 'Seedance 2.0 vs Sora 2',
      prelaunchCompareSecondaryLabel: 'Pika 2.2 vs Seedance 2.0',
      useCasesFallback: 'Interactive chips refine recommendations instantly. All links remain crawlable and available in plain HTML.',
    },
    tagLabels: {
      audio: 'Audio',
      cinematic: 'Cinematic',
      quality: 'Best quality',
      long: 'Long duration',
      ads: 'Ads',
      product: 'Product',
      value: 'Best value',
      general: 'General use',
      i2v: 'Image-to-video',
      social: 'Social',
      fast: 'Fast',
      storyboards: 'Storyboards',
    },
    useCaseLabels: {
      cinematic: 'Cinematic',
      ads: 'Ads',
      social: 'Social',
      product: 'Product',
      storyboards: 'Storyboards',
      audio: 'Audio',
      'no-audio': 'No audio',
      'best-value': 'Best value',
      'best-quality': 'Best quality',
      'text-to-video': 'Text-to-video',
      'image-to-video': 'Image-to-video',
      'video-to-video': 'Video-to-video',
    },
    popularCompareLabel: 'Compare',
    catalogLabels: {
      sortAll: 'All',
      toggles: {
        includeWaitlistEarlyAccess: 'Include waitlist / early access',
      },
      filters: {
        mode: 'Mode',
        audio: 'Audio',
        duration: 'Duration',
        resolution: 'Resolution',
        status: 'Status',
        provider: 'Provider',
        clear: 'Clear filters',
      },
      options: {
        all: 'All',
        modeT2v: 'Text-to-video',
        modeI2v: 'Image-to-video',
        modeV2v: 'Video-to-video',
        audioOn: 'Audio',
        audioOff: 'No audio',
        durationShort: '< 8s',
        durationMedium: '8-11s',
        durationLong: '12s+',
        resolution720: '720p+',
        resolution1080: '1080p+',
        resolution4k: '4K',
        statusLive: 'Live',
        statusEarly: 'Early access',
      },
      specs: {
        modes: 'Modes',
        audio: 'Audio',
        status: 'Status',
        duration: 'Max duration',
        resolution: 'Max resolution',
        yes: 'Yes',
        no: 'No',
        unknown: 'Unknown',
        secondsSuffix: 's',
        statusLive: 'Live',
        statusEarly: 'Early access',
      },
      ctas: {
        model: 'Model page',
        compare: 'Compare vs',
      },
      empty: 'No engines match these filters.',
    },
    listLabels: {
      searchPlaceholder: 'Search comparisons...',
      loadMore: 'Load more',
      empty: 'No comparisons match this search.',
    },
    faq: [
      {
        question: 'How do I compare two AI video engines quickly?',
        answer:
          'Use the Compare Now widget at the top of the page, choose Engine A and Engine B, then click Compare to open the canonical matchup page. Use the same prompt (or simple text prompt) across both AI models to compare motion consistency and prompt fidelity before you generate.',
      },
      {
        question: 'Why do some comparisons show different strengths?',
        answer:
          'Each model trades off speed, prompt fidelity, motion realism, duration, and audio support differently. The best choice depends on the specific shot and deadline. These tradeoffs are why comparing the AI video model before you generate videos saves time and cost.',
      },
      {
        question: 'Can I compare text-to-video and image-to-video engines together?',
        answer:
          'Yes. The hub includes mixed-mode matchups so you can compare engines that prioritize text prompts, image inputs, or both. Yes - you can also include video-to-video engines when available.',
      },
      {
        question: 'How should I choose between two close engines?',
        answer:
          'Start with the use case chips, then validate with a direct side-by-side test. For tie-breaks, run the same simple text prompt (or reference image) and prioritize prompt fidelity, motion consistency, and turnaround speed for your delivery format.',
      },
    ],
  };

export const EN_BEST_FOR_CTA: BestForCtaCopy = {
    title: 'Need a recommendation instead of a matchup?',
    body: 'Open the Best-for guides for use-case rankings across cinematics, references, ads, UGC, 4K, and multi-shot sequences.',
    label: 'Browse Best-for guides',
  };
