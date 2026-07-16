export const PAYG_ICON_IDS = [
  'model',
  'engine',
  'preview',
  'video',
  'refund',
  'duration',
  'resolution',
  'audio',
  'credits',
] as const;
export type PaygIconId = (typeof PAYG_ICON_IDS)[number];

export const PAYG_PRICE_LOOKUP_IDS = [
  'seedance-2-0',
  'kling-3-pro',
  'veo-3-1',
  'happy-horse-1-1',
  'seedance-2-0-mini',
  'ltx-2-3-fast',
] as const;
export type PaygPriceLookupId = (typeof PAYG_PRICE_LOOKUP_IDS)[number];

export const PAYG_EXAMPLE_COST_IDS = [
  'seedance-2-0',
  'kling-3-pro',
  'veo-3-1-fast',
  'happy-horse-1-1',
  'seedance-2-0-mini',
  'ltx-2-3-fast',
] as const;
export type PaygExampleCostId = (typeof PAYG_EXAMPLE_COST_IDS)[number];

export const PAYG_SUPPORTED_MODEL_IDS = [
  'seedance-2-0',
  'kling-3-pro',
  'veo-3-1',
  'happy-horse-1-1',
  'seedance-2-0-mini',
  'ltx-2-3-fast',
  'wan-2-6',
] as const;
export type PaygSupportedModelId = (typeof PAYG_SUPPORTED_MODEL_IDS)[number];

export const PAYG_SHOWCASE_TITLE_IDS = [
  'rooftop',
  'museum',
  'smooth-image',
  'guided-image',
  'racer',
  'ugc',
  'warrior',
  'product-image',
  'product-reveal',
] as const;
export type PaygShowcaseTitleId = (typeof PAYG_SHOWCASE_TITLE_IDS)[number];

export type PaygHeaderCopy = { eyebrow?: string; title: string; intro?: string };
export type PaygQuestion = { question: string; answer: string };
export type PaygCard = { title: string; body: string };

export type PayAsYouGoContent = {
  metadata: { title: string; description: string; imageAlt: string; keywords: string[] };
  common: { aiVideoModelAlt: string; liveQuote: string; audioIncluded: string; examplePrefix: string };
  hero: {
    eyebrow: string;
    title: string;
    intro: string;
    primaryCta: string;
    secondaryCta: string;
    trustItems: string[];
    quote: {
      consoleLabel: string;
      title: string;
      promptLabel: string;
      prompt: string;
      modelLabel: string;
      chooseModel: string;
      exampleCostLabel: string;
      chargeRuleLabel: string;
      chargeRuleValue: string;
    };
  };
  naturalQuestions: {
    header: PaygHeaderCopy;
    summaryLead: string;
    summaryItems: string[];
    items: PaygQuestion[];
  };
  modelTesting: {
    header: PaygHeaderCopy;
    footer: string;
    models: Record<PaygSupportedModelId, { family: string; title: string; body: string }>;
  };
  meaning: { title: string; body: string; bullets: string[] };
  noSubscription: { title: string; body: string; cards: PaygCard[] };
  audienceFit: { cards: Array<PaygCard & { bullets: string[] }> };
  subscriptionComparison: {
    header: PaygHeaderCopy;
    columns: [string, string, string];
    rows: Array<{ label: string; payg: string; subscription: string }>;
  };
  workflow: { header: PaygHeaderCopy; items: Array<PaygCard & { icon: PaygIconId }> };
  quoteFactors: { header: PaygHeaderCopy; items: Array<PaygCard & { icon: PaygIconId }> };
  pricing: {
    header: PaygHeaderCopy;
    fullMatrixLabel: string;
    columns: { model: string; bestFor: string; links: string };
    modelLinkLabel: string;
    compareLinkLabel: string;
    bestFor: Record<
      'seedanceMini' | 'seedance' | 'happyHorse' | 'kling' | 'veo' | 'ltx' | 'wan' | 'fallback',
      string
    >;
  };
  priceLookups: {
    header: PaygHeaderCopy;
    openRowLabel: string;
    items: Record<PaygPriceLookupId, { query: string; title: string; body: string }>;
  };
  exampleCosts: {
    header: PaygHeaderCopy;
    settingsLabel: string;
    labels: Record<PaygExampleCostId, string>;
  };
  refundPolicy: { header: PaygHeaderCopy; bullets: Array<{ icon: PaygIconId; body: string }> };
  faq: { title: string; items: PaygQuestion[] };
  showcase: {
    section: {
      eyebrow: string;
      title: string;
      intro: string;
      preview: string;
      result: string;
      cta: string;
      mediaPhrase: string;
      engineImageAltSuffix: string;
    };
    runtime: {
      priceUnavailable: string;
      defaultEngineLabel: string;
      defaultTitleEngineLabel: string;
      defaultTitleTemplate: string;
      titles: Record<PaygShowcaseTitleId, string>;
      fallbackTitles: { image: string; character: string; prompt: string };
      useCases: Record<
        'seedanceMini' | 'seedance' | 'kling' | 'veo' | 'happyHorseEarlier' | 'happyHorse11' | 'happyHorse' | 'ltx' | 'wan' | 'fallback',
        string
      >;
    };
  };
  jsonLd: {
    breadcrumbName: string;
    service: { name: string; description: string; serviceType: string; category: string; offer: string };
    webApplication: { description: string; offer: string; features: string[] };
  };
};
