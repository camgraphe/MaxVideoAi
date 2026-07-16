import type { PayAsYouGoContent } from './types';

export const enPayAsYouGoContent = {
  metadata: {
    title: 'Pay-as-you-go AI Video Generator with Upfront Pricing',
    description: 'Generate AI videos with pay-as-you-go credits instead of a monthly subscription. Compare Seedance 2, Kling, Google Veo, LTX, Wan and other models, see the price before generation, and pay only for completed renders.',
    imageAlt: 'MaxVideoAI price-before-generation workflow.',
    keywords: ['pay-as-you-go AI video generator', 'AI video generator without subscription', 'AI video pricing before generation', 'compare Seedance 2 Kling Google Veo LTX Happy Horse', 'Happy Horse 1.1 price', 'Seedance 2 Mini price'],
  },
  common: {
    aiVideoModelAlt: 'AI video model',
    liveQuote: 'Live quote',
    audioIncluded: 'Audio included',
    examplePrefix: 'Example',
  },
  hero: {
    eyebrow: 'AI video credits, no monthly lock-in',
    title: 'Pay-as-you-go AI Video Generator',
    intro: 'Generate AI videos from text, images, or video with pay-as-you-go credits. Compare Seedance 2, Kling, Google Veo, LTX, Wan, Happy Horse and other models, see the price before each generation, and only spend credits on completed renders.',
    primaryCta: 'Get a video quote',
    secondaryCta: 'View model pricing',
    trustItems: ['No subscription required', 'Starter credits from $10', 'Price shown before generation', 'Provider failures refunded'],
    quote: {
      consoleLabel: 'MaxVideoAI quote console',
      title: 'Price before generation',
      promptLabel: 'Prompt',
      prompt: 'Cinematic product reveal, slow camera push, clean studio lighting.',
      modelLabel: 'Model',
      chooseModel: 'Choose model',
      exampleCostLabel: 'Example cost',
      chargeRuleLabel: 'Charge rule',
      chargeRuleValue: 'Completed renders only',
    },
  },
  naturalQuestions: {
    header: {
      eyebrow: 'Quick answers',
      title: 'Quick answers before you spend credits',
      intro: 'A pay-as-you-go AI video generator lets you buy credits only when you need them, choose a model per project, review the price before rendering, and spend credits only when the render completes successfully.',
    },
    summaryLead: 'With MaxVideoAI, you can:',
    summaryItems: [
      'Generate AI videos from text, images, or video.',
      'Start with Seedance 2, then compare Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX and Wan.',
      'See the estimated price before launching.',
      'Use credits only for completed renders.',
    ],
    items: [
      { question: 'Where can I test AI video models without subscription?', answer: 'Use MaxVideoAI to start with Seedance 2, then compare Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan, and other models with pay-as-you-go credits instead of a recurring plan.' },
      { question: 'Which AI video platform shows prices before generation?', answer: 'MaxVideoAI shows the estimated generation price before you launch a render, including model, duration, resolution, and audio choices.' },
      { question: 'Which pay-as-you-go AI video model should I test first?', answer: 'Start with Seedance 2.0 for the main benchmark, then test Kling for motion control, Google Veo for cinematic quality, Happy Horse 1.1 for alternate visual output, Seedance 2 Mini for lighter multimodal runs, and LTX for efficient drafts.' },
      { question: 'Where can I compare Seedance 2, Kling, Google Veo, Happy Horse and LTX in one place?', answer: 'MaxVideoAI groups Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan, and other video engines in one workspace so you can compare quality, limits, and price before choosing.' },
      { question: 'What makes a good pay-as-you-go AI video generator?', answer: 'A good pay-as-you-go setup lets you test current models, see prices before generation, switch engines per project, and avoid charges for failed provider renders.' },
    ],
  },
  modelTesting: {
    header: {
      eyebrow: 'Model order',
      title: 'Recommended testing order for pay-as-you-go AI video',
      intro: 'For most current benchmark tests, start with Seedance 2.0. Then compare Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, and Wan depending on motion, cinematic quality, references, speed, and price.',
    },
    footer: 'Happy Horse 1.1 and Seedance 2 Mini are new enough that they should be tested directly instead of judged only by older model rankings.',
    models: {
      'seedance-2-0': { family: 'Seedance 2', title: 'Seedance 2.0 as the first model to test', body: 'Put Seedance 2 first when you need a current all-around route for text-to-video, image-to-video, references, native audio options, and production-quality tests.' },
      'kling-3-pro': { family: 'Kling', title: 'Kling as the solid motion-control choice', body: 'Use Kling when you want dependable camera motion, product shots, elements, and image-guided video generation without buying a subscription first.' },
      'veo-3-1': { family: 'Google Veo', title: 'Google Veo as the cinematic-quality choice', body: 'Compare Veo variants when prompt interpretation, cinematic polish, audio options, or Google video routes matter more than the lowest draft price.' },
      'happy-horse-1-1': { family: 'Happy Horse 1.1', title: 'Happy Horse 1.1 for alternate visual output', body: 'Use Happy Horse 1.1 when you want to compare a newer Alibaba video route against Seedance, Kling, Google Veo, and LTX.' },
      'seedance-2-0-mini': { family: 'Seedance 2 Mini', title: 'Seedance 2.0 Mini for lighter multimodal tests', body: 'Use Seedance 2 Mini when you want a lighter Seedance-family route for references, quick checks, and budget-aware iteration before scaling a prompt.' },
      'ltx-2-3-fast': { family: 'LTX', title: 'LTX 2.3 Fast as the efficient strong option', body: 'Use LTX 2.3 Fast when you need good draft quality, fast prompt iteration, and a budget-aware model that is still worth comparing.' },
      'wan-2-6': { family: 'Wan', title: 'Wan for lower-cost text and image-to-video exploration', body: 'Use Wan when you need a practical route for trying ideas and comparing results before spending on premium engines.' },
    },
  },
  meaning: {
    title: 'What pay-as-you-go means',
    body: 'Pay-as-you-go means you buy credits when you need them instead of paying for a recurring plan. For each video, you choose a model, duration, resolution, audio option, and workflow. MaxVideoAI shows the estimated price before you launch the generation.',
    bullets: ['No monthly lock-in or idle plan spend', 'Choose a different model per project', 'Use credits across text-to-video, image-to-video, and video workflows'],
  },
  noSubscription: {
    title: 'Why no subscription matters',
    body: 'AI video models change quickly. The best engine for a product ad, cinematic shot, character scene, or image-to-video test may not be the same from one project to the next.',
    cards: [
      { title: 'Test before scaling', body: 'Run small prompt and image tests before committing budget to a campaign or production workflow.' },
      { title: 'Avoid idle spend', body: 'If you generate videos only for launches, experiments, or client work, credits map better to real usage.' },
      { title: 'Switch models freely', body: 'Compare Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan, speed, motion quality, audio support, duration, and price in one place.' },
    ],
  },
  audienceFit: {
    cards: [
      {
        title: 'Who uses pay-as-you-go AI video credits?',
        body: 'Creators, agencies, SaaS teams, ecommerce brands, marketers, and studios use credits when AI video generation is project-based instead of monthly.',
        bullets: ['Test prompts before a campaign', 'Create product ads and client drafts', 'Turn approved images into short videos', 'Compare whether a premium model is worth the cost'],
      },
      {
        title: 'When a subscription may fit better',
        body: 'A subscription can make sense if you generate large volumes every week on the same platform. Pay-as-you-go fits changing usage, model comparison, and avoiding idle monthly spend.',
        bullets: ['Project-by-project usage', 'Multiple model families in one workflow', 'Live quote before each render', 'No recurring commitment before testing quality'],
      },
    ],
  },
  subscriptionComparison: {
    header: {
      eyebrow: 'No subscription required',
      title: 'Pay-as-you-go vs subscription',
      intro: 'The right billing model depends on how often you generate, how many models you need to test, and whether unused monthly credits create waste.',
    },
    columns: ['Decision point', 'MaxVideoAI pay-as-you-go', 'Typical subscription'],
    rows: [
      { label: 'Budget control', payg: 'Add credits when you need videos and stop when the project is done.', subscription: 'Pay a recurring plan even in months where you do not render.' },
      { label: 'Model choice', payg: 'Compare Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX and other engines per job.', subscription: 'Often tied to one vendor, one model family, or one usage pool.' },
      { label: 'Price visibility', payg: 'Review the quote before each generation starts.', subscription: 'Included credits can hide the real cost of premium settings.' },
      { label: 'Experimentation', payg: 'Run small tests before scaling a campaign, client project, or production workflow.', subscription: 'A plan decision usually happens before you know which model fits.' },
    ],
  },
  workflow: {
    header: {
      title: 'How pay-as-you-go credits work',
      intro: 'The workflow is designed to make cost visible before launch, then hand detailed price comparisons to the pricing page.',
    },
    items: [
      { title: 'Choose a video engine', body: 'Select the model that fits the brief instead of being locked into one subscription catalog.', icon: 'engine' },
      { title: 'Review the live quote', body: 'See price, duration, resolution, audio, and workflow choices before generation.', icon: 'preview' },
      { title: 'Launch the generation', body: 'Run a text-to-video, image-to-video, or video workflow only after the cost is visible.', icon: 'video' },
      { title: 'Spend on success', body: 'Completed renders consume credits. Provider failures are refunded or not charged when no usable result returns.', icon: 'refund' },
    ],
  },
  quoteFactors: {
    header: {
      title: 'What changes the live quote',
      intro: 'The app quote combines the choices that actually affect render cost, so the price you approve matches the generation you launch.',
    },
    items: [
      { title: 'Model', body: 'Premium engines and fast variants can price differently.', icon: 'model' },
      { title: 'Duration', body: 'Longer clips consume more credits than short drafts.', icon: 'duration' },
      { title: 'Resolution', body: '1080p, 4K, and high-quality outputs change the quote.', icon: 'resolution' },
      { title: 'Audio and workflow', body: 'Audio, image references, video inputs, and tool routes can affect cost.', icon: 'audio' },
    ],
  },
  pricing: {
    header: {
      title: 'Compare price per model',
      intro: 'These examples help you estimate cost quickly. Use the pricing page for the full model-by-model matrix, then open the app for the exact live quote before rendering.',
    },
    fullMatrixLabel: 'Full pricing matrix',
    columns: { model: 'Model', bestFor: 'Best for', links: 'Links' },
    modelLinkLabel: 'Model',
    compareLinkLabel: 'Compare',
    bestFor: {
      seedanceMini: 'lighter Seedance 2 tests, multimodal references, and fast iteration',
      seedance: 'current all-around video generation, references, and native audio tests',
      happyHorse: 'alternate Alibaba video output and newer model comparison',
      kling: 'motion control, image-to-video, and creator workflows',
      veo: 'cinematic quality, prompt-following, and Google Veo variants',
      ltx: 'efficient drafts, prompt iteration, and strong budget-aware output',
      wan: 'budget-friendly text and image-to-video exploration',
      fallback: 'testing model quality before committing credits',
    },
  },
  priceLookups: {
    header: {
      eyebrow: 'Quick price checks',
      title: 'Check prices for popular AI video models',
      intro: 'Use these model-specific shortcuts for quick estimates. The full pricing matrix stays the source of truth for exact model, duration, resolution, and audio combinations.',
    },
    openRowLabel: 'Open pricing row',
    items: {
      'seedance-2-0': { query: 'seedance 2 price', title: 'Seedance 2.0 price lookup', body: 'Start here for the current all-around model: strong text-to-video, image references, native audio options, and a quote before rendering.' },
      'kling-3-pro': { query: 'kling 3 pro price', title: 'Kling 3 Pro price lookup', body: 'A solid route for controlled motion, camera moves, product shots, and image-to-video tests without a monthly plan.' },
      'veo-3-1': { query: 'veo 3.1 price', title: 'Veo 3.1 price lookup', body: 'Use Google Veo when cinematic prompt interpretation, Google video quality, or premium visual polish matters more than draft cost.' },
      'happy-horse-1-1': { query: 'happy horse 1.1 price', title: 'Happy Horse 1.1 price lookup', body: 'Check Happy Horse 1.1 when Alibaba video output, references, or a different visual feel may beat the defaults.' },
      'seedance-2-0-mini': { query: 'seedance 2 mini price', title: 'Seedance 2.0 Mini price lookup', body: 'Use Seedance 2 Mini for lighter multimodal tests, shorter iterations, and lower-friction checks before moving to the main Seedance 2 route.' },
      'ltx-2-3-fast': { query: 'ltx 2.3 pricing', title: 'LTX 2.3 Fast price lookup', body: 'Use LTX 2.3 Fast as a strong, efficient option for drafts, prompt iteration, and budget-aware production planning.' },
    },
  },
  exampleCosts: {
    header: {
      title: 'Example costs',
      intro: 'These examples are shortcuts from the current pricing hub. They are useful for orientation, while the app quote is the final price before generation.',
    },
    settingsLabel: 'Example settings',
    labels: {
      'seedance-2-0': 'Seedance 2 starter render',
      'kling-3-pro': 'Kling 3 Pro motion test',
      'veo-3-1-fast': 'Google Veo 3.1 Fast cinematic test',
      'happy-horse-1-1': 'Happy Horse 1.1 alternate route test',
      'seedance-2-0-mini': 'Seedance 2 Mini quick test',
      'ltx-2-3-fast': 'LTX 2.3 Fast draft test',
    },
  },
  refundPolicy: {
    header: {
      title: 'What happens if a generation fails?',
      intro: 'MaxVideoAI is designed around completed-render billing. Completed renders consume credits. Failed provider jobs are refunded or not charged when the provider does not return a usable result.',
    },
    bullets: [
      { icon: 'preview', body: 'You review the price before launching a generation.' },
      { icon: 'credits', body: 'Credits are consumed for completed renders.' },
      { icon: 'refund', body: 'Provider failures are refunded or not charged when the provider does not return usable output.' },
    ],
  },
  faq: {
    title: 'FAQ',
    items: [
      { question: 'Do I need a subscription to generate AI videos?', answer: 'No. MaxVideoAI supports pay-as-you-go credits so you can generate when you need video output.' },
      { question: 'Can I see the AI video price before generation?', answer: 'Yes. The app shows a live quote before generation based on model, duration, resolution, audio, and workflow settings.' },
      { question: 'Which AI video model should I test first?', answer: 'Start with Seedance 2.0 for the main benchmark, then compare Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, and Wan based on recency, motion control, cinematic quality, visual style, and price.' },
      { question: 'What happens if a render fails?', answer: 'Completed renders consume credits. Failed provider jobs are refunded or not charged when the provider does not return a usable result.' },
      { question: 'Is this the same as the pricing page?', answer: 'No. This page answers pay-as-you-go and no-subscription intent directly. The pricing page remains the detailed model and scenario matrix.' },
    ],
  },
  showcase: {
    section: {
      eyebrow: 'Real pay-as-you-go outputs',
      title: 'Example videos with model and price context',
      intro: 'A short strip from public MaxVideoAI renders, showing the model, duration, and recorded render price when available.',
      preview: 'Preview',
      result: 'View prompt and result',
      cta: 'Test your prompt with a live quote',
      mediaPhrase: 'example video generated with',
      engineImageAltSuffix: 'AI video model',
    },
    runtime: {
      priceUnavailable: 'Price shown first',
      defaultEngineLabel: 'AI video model',
      defaultTitleEngineLabel: 'AI video',
      defaultTitleTemplate: '{engine} example render',
      titles: {
        rooftop: 'Cinematic rooftop chase',
        museum: 'Museum curator walkthrough',
        'smooth-image': 'Smooth image-to-video animation',
        'guided-image': 'Image-guided cinematic scene',
        racer: 'Female racer character test',
        ugc: 'Vertical UGC selfie test',
        warrior: 'Dark warrior temple scene',
        'product-image': 'Product image-to-video test',
        'product-reveal': 'Cinematic product reveal',
      },
      fallbackTitles: { image: 'Image-guided cinematic scene', character: 'Character motion test', prompt: 'Text-to-video prompt test' },
      useCases: {
        seedanceMini: 'Lighter multimodal test before scaling.',
        seedance: 'Current benchmark render for model testing.',
        kling: 'Motion-control or image-to-video test.',
        veo: 'Cinematic quality and prompt-following test.',
        happyHorseEarlier: 'Earlier Happy Horse render used as an Alibaba-route example.',
        happyHorse11: 'Happy Horse 1.1 alternate Alibaba video route.',
        happyHorse: 'Alternate Alibaba video route.',
        ltx: 'Efficient draft and prompt-iteration test.',
        wan: 'Budget-aware text or image-to-video test.',
        fallback: 'Public render with model and price context.',
      },
    },
  },
  jsonLd: {
    breadcrumbName: 'Pay-as-you-go AI Video Generator',
    service: {
      name: 'Pay-as-you-go AI Video Generator',
      description: 'Generate AI videos from text, images, or video with no subscription required, price-before-generation quotes, and failed-render refunds.',
      serviceType: 'Pay-as-you-go AI video generation',
      category: 'AI video generator',
      offer: 'Starter credits are available without a recurring subscription.',
    },
    webApplication: {
      description: 'Pay-as-you-go AI video generator for comparing multiple AI video models with upfront pricing and no required subscription.',
      offer: 'Starter credits are available without a recurring subscription.',
      features: ['Generate AI videos from text, images, or video', 'Compare Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan and other models', 'See the estimated price before generation', 'Use credits for completed renders'],
    },
  },
} satisfies PayAsYouGoContent;
