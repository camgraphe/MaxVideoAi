import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  ContentMomentumItem,
  CtrDoctorItem,
  InternalLinkSuggestion,
  MissingContentItem,
  StrategicSeoOpportunity,
  UrlInspectionItem,
} from '../frontend/lib/seo/internal-seo-types';
import {
  buildUnifiedActionBriefs,
  formatUnifiedActionBriefsMarkdown,
} from '../frontend/lib/seo/unified-action-briefs';

const ltxMetrics = { clicks: 79, impressions: 378, ctr: 0.209, averagePosition: 5.5 };

function opportunity(overrides: Partial<StrategicSeoOpportunity> = {}): StrategicSeoOpportunity {
  return {
    id: 'op-ltx',
    title: 'Strengthen LTX prompt examples',
    priority: 'high',
    score: 88,
    targetUrl: '/examples/ltx',
    queryCluster: 'ltx 2.3 prompt examples',
    representativeQueries: ['ltx 2.3 prompt examples', 'how to prompt ltx 2.3'],
    modelFamily: 'LTX',
    intent: 'prompt_examples',
    issueType: 'prompt_examples_intent',
    observedIssue: 'LTX prompt-example demand is visible with room to grow.',
    suggestedAction: 'Clarify LTX 2.3 prompt examples on the examples page.',
    expectedImpact: 'Improve prompt-example clicks and rankings.',
    sourceMetrics: ltxMetrics,
    businessPriorityWeight: 1.2,
    codexTaskDraft: 'Task draft',
    ...overrides,
  };
}

function ctrDoctor(overrides: Partial<CtrDoctorItem> = {}): CtrDoctorItem {
  return {
    id: 'ctr-ltx',
    title: 'Improve snippet match for LTX 2.3 prompt examples',
    priority: 'high',
    score: 82,
    targetUrl: '/examples/ltx',
    queryCluster: 'ltx 2.3 prompt examples',
    representativeQueries: ['ltx 2.3 prompt examples'],
    currentMetrics: ltxMetrics,
    modelFamily: 'LTX',
    detectedIntent: 'prompt_examples',
    issueType: 'expand_defend_good_performer',
    likelyProblem: 'The page is performing, but the prompt examples angle can be clearer.',
    recommendedTitleDirection: 'Review title/meta so LTX 2.3 prompt examples are clear if appropriate.',
    recommendedMetaDescriptionDirection: 'Mention prompt examples naturally.',
    recommendedH1SectionDirection: 'Review H1 or section wording.',
    aboveTheFoldRecommendation: 'Make the example intent clear above the fold without keyword stuffing.',
    currentMetadata: null,
    codexTaskDraft: 'CTR task',
    acceptanceCriteria: ['No keyword stuffing'],
    ...overrides,
  };
}

function missingContent(overrides: Partial<MissingContentItem> = {}): MissingContentItem {
  return {
    id: 'missing-ltx',
    priority: 'medium',
    score: 64,
    recommendationType: 'add_examples_block',
    targetUrl: '/examples/ltx',
    likelyPageCandidates: [],
    queryCluster: 'ltx 2.3 prompt examples',
    representativeQueries: ['ltx 2.3 prompt examples'],
    family: 'LTX',
    intent: 'prompt_examples',
    currentMetrics: ltxMetrics,
    observedGap: 'Prompt examples intent should be clearer on the page.',
    recommendedAction: 'Add or clarify a compact LTX 2.3 prompt examples block.',
    whyThisAction: 'The existing examples page is the right target.',
    whyNotCreatePage: 'Do not create a new page while the existing examples page matches the intent.',
    codexTaskDraft: 'Missing content task',
    acceptanceCriteria: ['Examples block is visible'],
    ...overrides,
  };
}

function internalLink(overrides: Partial<InternalLinkSuggestion> = {}): InternalLinkSuggestion {
  return {
    id: 'link-ltx',
    priority: 'low',
    score: 42,
    recommendationType: 'examples_to_model',
    sourceUrl: '/examples/ltx',
    targetUrl: '/models/ltx-2-3-pro',
    sourceType: 'family_examples',
    targetType: 'model_page',
    suggestedAnchor: 'LTX 2.3 prompt examples and specs',
    reason: 'Support the LTX examples page with clear model links.',
    relatedQueryCluster: 'ltx 2.3 prompt examples',
    representativeQueries: ['ltx 2.3 prompt examples'],
    family: 'LTX',
    intent: 'prompt_examples',
    currentMetrics: ltxMetrics,
    verifyExistingLinkFirst: true,
    codexTaskDraft: 'Internal link task',
    acceptanceCriteria: ['Verify current LTX model links'],
    ...overrides,
  };
}

function momentum(overrides: Partial<ContentMomentumItem> = {}): ContentMomentumItem {
  return {
    id: 'momentum-ltx',
    type: 'protect_winner',
    priority: 'high',
    score: 78,
    pageUrl: '/examples/ltx',
    queryCluster: 'ltx 2.3 prompt examples',
    family: 'LTX',
    current: ltxMetrics,
    previous: { clicks: 38, impressions: 210, ctr: 0.181, averagePosition: 6.2 },
    clickDelta: 41,
    impressionDelta: 168,
    ctrDelta: 0.028,
    positionDelta: -0.7,
    observedTrend: 'LTX prompt examples are gaining momentum.',
    recommendedAction: 'Protect and expand the winning examples page.',
    whyItMatters: 'This is a strategic family with growing prompt-example demand.',
    codexTaskDraft: 'Momentum task',
    acceptanceCriteria: ['Do not turn a winner into a generic SEO page'],
    ...overrides,
  };
}

function inspection(overrides: Partial<UrlInspectionItem> = {}): UrlInspectionItem {
  return {
    path: '/examples/ltx',
    url: 'https://maxvideoai.com/examples/ltx',
    group: 'examples',
    sources: ['manual'],
    lastInspectedAt: '2026-04-30T19:50:55.526Z',
    status: 'indexed_ok',
    severity: 'ok',
    indexVerdict: 'PASS',
    coverageState: 'Submitted and indexed',
    robotsTxtState: 'ALLOWED',
    indexingState: 'INDEXING_ALLOWED',
    pageFetchState: 'SUCCESSFUL',
    googleCanonical: 'https://maxvideoai.com/examples/ltx',
    userCanonical: 'https://maxvideoai.com/examples/ltx',
    canonicalMatches: true,
    lastCrawlTime: '2026-04-30T12:50:17Z',
    sitemapPresent: null,
    sitemaps: [],
    mobileUsabilityStatus: 'VERDICT_UNSPECIFIED',
    richResultsStatus: 'PASS',
    richResultTypes: ['Breadcrumbs', 'FAQ'],
    inspectionResultLink: null,
    suggestedAction: 'No immediate action. Monitor canonical, crawl recency, and rich result signals.',
    raw: null,
    ...overrides,
  };
}

test('merges multiple module signals into one page action brief', () => {
  const briefs = buildUnifiedActionBriefs({
    opportunities: [opportunity()],
    ctrDoctorItems: [ctrDoctor()],
    missingContentItems: [missingContent()],
    internalLinkSuggestions: [internalLink()],
    momentumItems: [momentum()],
    urlInspectionItems: [inspection()],
  });

  assert.equal(briefs.length, 1);
  assert.equal(briefs[0].targetUrl, '/examples/ltx');
  assert.equal(briefs[0].queryCluster, 'ltx 2.3 prompt examples');
  assert.deepEqual(briefs[0].sourceModules.sort(), ['ctr_doctor', 'internal_links', 'missing_content', 'momentum', 'opportunity_finder', 'url_inspection'].sort());
  assert.equal(briefs[0].pageStatus, 'indexed_ok');
  assert.match(briefs[0].recommendedImplementation, /title\/meta\/H1\/intro/i);
  assert.match(briefs[0].recommendedImplementation, /LTX 2\.3 prompt examples/i);
  assert.ok(briefs[0].recommendedImplementation.includes('/models/ltx-2-3-pro'));
  assert.match(briefs[0].copyReadyCodexTask, /Acceptance criteria:/);
});

test('/examples/ltx combined brief keeps examples-first acceptance criteria', () => {
  const [brief] = buildUnifiedActionBriefs({
    opportunities: [opportunity()],
    ctrDoctorItems: [ctrDoctor()],
    missingContentItems: [missingContent()],
    internalLinkSuggestions: [internalLink({ targetUrl: '/models/ltx-2-3-fast' })],
    momentumItems: [momentum()],
    urlInspectionItems: [inspection()],
  });

  assert.ok(brief.acceptanceCriteria.some((criterion) => /examples-first/i.test(criterion)));
  assert.ok(brief.acceptanceCriteria.some((criterion) => /No keyword stuffing/i.test(criterion)));
  assert.ok(brief.acceptanceCriteria.some((criterion) => criterion.includes('indexed/canonical OK')));
  assert.ok(brief.supportingActions.some((action) => action.includes('/models/ltx-2-3-fast')));
});

test('URL Inspection indexed_ok is context, not a standalone task', () => {
  const briefs = buildUnifiedActionBriefs({
    opportunities: [],
    ctrDoctorItems: [],
    missingContentItems: [],
    internalLinkSuggestions: [],
    momentumItems: [],
    urlInspectionItems: [inspection()],
  });

  assert.equal(briefs.length, 0);
});

test('duplicate module items do not create duplicate briefs', () => {
  const briefs = buildUnifiedActionBriefs({
    opportunities: [opportunity(), opportunity({ id: 'op-ltx-duplicate', issueType: 'position_4_to_12' })],
    ctrDoctorItems: [ctrDoctor()],
    missingContentItems: [missingContent()],
    internalLinkSuggestions: [internalLink()],
    momentumItems: [momentum()],
    urlInspectionItems: [inspection()],
  });

  assert.equal(briefs.length, 1);
  assert.ok(briefs[0].combinedSignals.some((signal) => signal.module === 'opportunity_finder' && /position/i.test(signal.summary)));
});

test('brand page action briefs are capped below critical', () => {
  const briefs = buildUnifiedActionBriefs({
    opportunities: [
      opportunity({
        id: 'brand-op',
        priority: 'critical',
        score: 95,
        targetUrl: '/',
        queryCluster: 'maxvedio',
        modelFamily: 'Brand',
        intent: 'brand_typo',
        issueType: 'brand_typo',
        representativeQueries: ['maxvedio'],
      }),
    ],
    ctrDoctorItems: [],
    missingContentItems: [],
    internalLinkSuggestions: [],
    momentumItems: [],
    urlInspectionItems: [inspection({ path: '/', url: 'https://maxvideoai.com/' })],
  });

  assert.equal(briefs[0].priority, 'high');
});

test('internal-link-only maintenance briefs stay low priority', () => {
  const briefs = buildUnifiedActionBriefs({
    opportunities: [],
    ctrDoctorItems: [],
    missingContentItems: [],
    internalLinkSuggestions: [internalLink({ priority: 'high' })],
    momentumItems: [],
    urlInspectionItems: [],
  });

  assert.equal(briefs.length, 1);
  assert.equal(briefs[0].priority, 'low');
  assert.deepEqual(briefs[0].sourceModules, ['internal_links']);
});

test('export markdown starts with recommended page actions and JSON shape is stable', () => {
  const briefs = buildUnifiedActionBriefs({
    opportunities: [opportunity()],
    ctrDoctorItems: [ctrDoctor()],
    missingContentItems: [missingContent()],
    internalLinkSuggestions: [],
    momentumItems: [],
    urlInspectionItems: [inspection()],
  });
  const markdown = formatUnifiedActionBriefsMarkdown(briefs);
  const payload = { unifiedActionBriefs: briefs };

  assert.match(markdown, /^# Recommended Page Actions/);
  assert.equal(Array.isArray(payload.unifiedActionBriefs), true);
  assert.equal(payload.unifiedActionBriefs[0]?.pageStatus, 'indexed_ok');
});
