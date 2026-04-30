import type { GscPerformanceRow, GscPerformanceSummary } from './gsc-analysis';

export type StrategicSeoFamily = string;

export type SeoFamilyStatus =
  | 'strategic'
  | 'supported'
  | 'emerging'
  | 'deprioritized'
  | 'unknown'
  | 'brand';

export type SeoFamilyDictionaryEntry = {
  id: string;
  label: StrategicSeoFamily;
  status: SeoFamilyStatus;
  aliases: string[];
  modelSlugs: string[];
  currentModelSlugs: string[];
  publishedModelSlugs: string[];
  defaultModelSlug: string | null;
  businessPriorityWeight: number;
  businessPriorityRank: number;
};

export type SeoIntentType =
  | 'brand'
  | 'brand_typo'
  | 'comparison'
  | 'pricing'
  | 'specs'
  | 'pricing_specs'
  | 'prompt_examples'
  | 'prompt_guide'
  | 'pay_as_you_go'
  | 'examples'
  | 'max_length'
  | 'image_to_video'
  | 'text_to_video'
  | 'camera_movement'
  | 'first_last_frame'
  | 'product_advertisement'
  | 'realistic_humans'
  | 'model_parameters'
  | 'best_ai_video_generator'
  | 'model_page'
  | 'generic';

export type SeoActionPriority = 'critical' | 'high' | 'medium' | 'low';

export type StrategicSeoIssueType =
  | 'high_impressions_low_ctr'
  | 'good_position_zero_clicks'
  | 'position_4_to_12'
  | 'model_family_opportunity'
  | 'comparison_intent'
  | 'prompt_examples_intent'
  | 'pricing_specs_intent'
  | 'brand_typo'
  | 'outdated_deprioritized_model';

export type SeoSourceMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
};

export type SeoQueryCluster = {
  id: string;
  label: string;
  key: string;
  targetUrl: string | null;
  modelFamily: StrategicSeoFamily;
  intent: SeoIntentType;
  representativeQueries: string[];
  importantTerms: string[];
  rows: GscPerformanceRow[];
  metrics: SeoSourceMetrics;
};

export type StrategicSeoOpportunity = {
  id: string;
  title: string;
  priority: SeoActionPriority;
  score: number;
  targetUrl: string | null;
  queryCluster: string;
  representativeQueries: string[];
  modelFamily: StrategicSeoFamily;
  intent: SeoIntentType;
  issueType: StrategicSeoIssueType;
  observedIssue: string;
  suggestedAction: string;
  expectedImpact: string;
  sourceMetrics: SeoSourceMetrics;
  businessPriorityWeight: number;
  codexTaskDraft: string;
};

export type SeoFamilyMomentum = 'gaining' | 'declining' | 'flat' | 'unknown';

export type SeoFamilyTrackerItem = GscPerformanceSummary & {
  family: StrategicSeoFamily;
  familyStatus: SeoFamilyStatus;
  businessPriorityRank: number;
  businessPriorityLabel: string;
  opportunityCount: number;
  highPriorityOpportunityCount: number;
  topQueryClusters: string[];
  recommendedNextAction: string;
  momentum: SeoFamilyMomentum;
  impressionsDelta: number | null;
  clicksDelta: number | null;
};

export type CodexSeoAction = {
  id: string;
  title: string;
  priority: SeoActionPriority;
  targetUrl: string | null;
  family: StrategicSeoFamily;
  intent: SeoIntentType;
  issueType: StrategicSeoIssueType;
  queryCluster: string;
  representativeQueries: string[];
  observedIssue: string;
  metricsSummary: string;
  recommendedImplementation: string;
  likelyFilesToInspect: string[];
  acceptanceCriteria: string[];
  markdown: string;
  score: number;
};

export type SeoPageMetadataSnapshot = {
  source: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  intro: string | null;
};

export type CtrDoctorIssueType =
  | 'high_impressions_low_ctr'
  | 'good_position_zero_clicks'
  | 'intent_snippet_mismatch'
  | 'expand_defend_good_performer'
  | 'far_position_watchlist'
  | 'brand_typo_ctr';

export type CtrDoctorItem = {
  id: string;
  title: string;
  priority: SeoActionPriority;
  score: number;
  targetUrl: string | null;
  queryCluster: string;
  representativeQueries: string[];
  currentMetrics: SeoSourceMetrics;
  modelFamily: StrategicSeoFamily;
  detectedIntent: SeoIntentType;
  issueType: CtrDoctorIssueType;
  likelyProblem: string;
  recommendedTitleDirection: string;
  recommendedMetaDescriptionDirection: string;
  recommendedH1SectionDirection: string;
  aboveTheFoldRecommendation: string;
  currentMetadata: SeoPageMetadataSnapshot | null;
  codexTaskDraft: string;
  acceptanceCriteria: string[];
};

export type MissingContentIntentType =
  | SeoIntentType
  | 'faq_info'
  | 'irrelevant_junk';

export type MissingContentRecommendationType =
  | 'add_section'
  | 'add_faq'
  | 'add_comparison_block'
  | 'add_specs_block'
  | 'add_pricing_block'
  | 'add_examples_block'
  | 'strengthen_existing_page'
  | 'create_page'
  | 'watchlist'
  | 'ignore';

export type MissingContentItem = {
  id: string;
  priority: SeoActionPriority;
  score: number;
  recommendationType: MissingContentRecommendationType;
  targetUrl: string | null;
  likelyPageCandidates: string[];
  queryCluster: string;
  representativeQueries: string[];
  family: StrategicSeoFamily;
  intent: MissingContentIntentType;
  currentMetrics: SeoSourceMetrics;
  observedGap: string;
  recommendedAction: string;
  whyThisAction: string;
  whyNotCreatePage: string | null;
  codexTaskDraft: string;
  acceptanceCriteria: string[];
};

export type SeoPageType =
  | 'homepage'
  | 'models_hub'
  | 'examples_hub'
  | 'family_examples'
  | 'model_page'
  | 'compare_hub'
  | 'compare_page'
  | 'pricing'
  | 'other';

export type InternalLinkRecommendationType =
  | 'family_hub_to_model'
  | 'model_to_examples'
  | 'compare_to_model'
  | 'examples_to_model'
  | 'pricing_to_model'
  | 'hub_to_opportunity';

export type InternalLinkSuggestion = {
  id: string;
  priority: SeoActionPriority;
  score: number;
  recommendationType: InternalLinkRecommendationType;
  sourceUrl: string;
  targetUrl: string;
  sourceType: SeoPageType;
  targetType: SeoPageType;
  suggestedAnchor: string;
  reason: string;
  relatedQueryCluster: string;
  representativeQueries: string[];
  family: StrategicSeoFamily;
  intent: SeoIntentType;
  currentMetrics: SeoSourceMetrics;
  verifyExistingLinkFirst: boolean;
  codexTaskDraft: string;
  acceptanceCriteria: string[];
};

export type ContentMomentumType =
  | 'gaining_page'
  | 'declining_page'
  | 'gaining_cluster'
  | 'declining_cluster'
  | 'rising_family'
  | 'declining_family'
  | 'mixed_family_momentum'
  | 'refresh_candidate'
  | 'protect_winner'
  | 'outdated_model_attention'
  | 'watchlist';

export type ContentMomentumItem = {
  id: string;
  type: ContentMomentumType;
  priority: SeoActionPriority;
  score: number;
  pageUrl: string | null;
  queryCluster: string | null;
  family: StrategicSeoFamily;
  current: SeoSourceMetrics;
  previous: SeoSourceMetrics;
  clickDelta: number;
  impressionDelta: number;
  ctrDelta: number;
  positionDelta: number;
  observedTrend: string;
  recommendedAction: string;
  whyItMatters: string;
  codexTaskDraft: string;
  acceptanceCriteria: string[];
};

export type UrlInspectionTargetSource =
  | 'manual'
  | 'opportunity'
  | 'ctr'
  | 'missing_content'
  | 'internal_link'
  | 'momentum'
  | 'strategic';

export type UrlInspectionGroup =
  | 'core'
  | 'strategic-models'
  | 'examples'
  | 'comparisons'
  | 'opportunities'
  | 'manual';

export type UrlInspectionStatus =
  | 'indexed_ok'
  | 'indexed_canonical_mismatch'
  | 'not_indexed'
  | 'discovered_not_indexed'
  | 'crawled_not_indexed'
  | 'blocked_by_robots'
  | 'noindex'
  | 'redirect'
  | 'not_found'
  | 'server_error'
  | 'unknown';

export type UrlInspectionSeverity = 'ok' | 'info' | 'warning' | 'critical' | 'unknown';

export type UrlInspectionTarget = {
  path: string;
  url: string;
  group: UrlInspectionGroup;
  sources: UrlInspectionTargetSource[];
};

export type UrlInspectionItem = UrlInspectionTarget & {
  lastInspectedAt: string | null;
  status: UrlInspectionStatus;
  severity: UrlInspectionSeverity;
  indexVerdict: string | null;
  coverageState: string | null;
  robotsTxtState: string | null;
  indexingState: string | null;
  pageFetchState: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  canonicalMatches: boolean | null;
  lastCrawlTime: string | null;
  sitemapPresent: boolean | null;
  sitemaps: string[];
  mobileUsabilityStatus: string | null;
  richResultsStatus: string | null;
  richResultTypes: string[];
  inspectionResultLink: string | null;
  suggestedAction: string;
  raw: unknown | null;
};

export type UnifiedActionSourceModule =
  | 'opportunity_finder'
  | 'ctr_doctor'
  | 'missing_content'
  | 'internal_links'
  | 'momentum'
  | 'url_inspection';

export type UnifiedActionSignal = {
  module: UnifiedActionSourceModule;
  priority: SeoActionPriority;
  summary: string;
};

export type UnifiedPageActionBrief = {
  id: string;
  priority: SeoActionPriority;
  score: number;
  targetUrl: string;
  queryCluster: string;
  representativeQueries: string[];
  family: StrategicSeoFamily;
  intent: SeoIntentType;
  pageStatus: UrlInspectionStatus | null;
  combinedSignals: UnifiedActionSignal[];
  metricsSummary: string;
  observedProblem: string;
  recommendedImplementation: string;
  supportingActions: string[];
  risks: string[];
  acceptanceCriteria: string[];
  sourceModules: UnifiedActionSourceModule[];
  copyReadyCodexTask: string;
};
