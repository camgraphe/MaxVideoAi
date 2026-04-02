const Veo31LiteEntry: Partial<FalEngineEntry> = {
  id: 'veo-3-1-lite',
  modelSlug: 'veo-3-1-lite',
  marketingName: 'Google Veo 3.1 Lite',
  family: 'veo',
  availability: 'available',
  versionLabel: '',
  surfaces: {
    modelPage: {
      indexable: true,
      includeInSitemap: true,
    },
    examples: {
      includeInFamilyResolver: true,
      includeInFamilyCopy: true,
    },
    compare: {
      suggestOpponents: [],
      publishedPairs: [],
      includeInHub: false,
    },
    app: {
      enabled: true,
      discoveryRank: undefined,
      variantGroup: undefined,
      variantLabel: undefined,
    },
    pricing: {
      includeInEstimator: true,
      featuredScenario: undefined,
    },
  },
};
// Insert this block into frontend/src/config/falEngines.ts and complete engine/spec details.
// Family stage is indexed, so decide separately when to add compare publication and examples copy exposure.
