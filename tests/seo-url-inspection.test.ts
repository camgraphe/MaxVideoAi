import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  CtrDoctorItem,
  MissingContentItem,
  StrategicSeoOpportunity,
} from '../frontend/lib/seo/internal-seo-types';
import {
  buildCuratedUrlInspectionTargets,
  formatUrlInspectionSectionMarkdown,
  normalizeUrlInspectionItem,
  sanitizeUrlInspectionItemsForExport,
  shouldSkipRecentUrlInspection,
} from '../frontend/lib/seo/url-inspection';

function opportunity(targetUrl: string): StrategicSeoOpportunity {
  return {
    id: `op-${targetUrl}`,
    title: 'Opportunity',
    priority: 'high',
    score: 90,
    targetUrl,
    queryCluster: 'seedance 2.0 vs seedance 2.0 fast',
    representativeQueries: ['seedance 2.0 vs seedance 2.0 fast'],
    modelFamily: 'Seedance',
    intent: 'comparison',
    issueType: 'comparison_intent',
    observedIssue: 'Comparison demand',
    suggestedAction: 'Strengthen comparison',
    expectedImpact: 'Improve clicks',
    sourceMetrics: { clicks: 10, impressions: 100, ctr: 0.1, averagePosition: 5 },
    businessPriorityWeight: 1.35,
    codexTaskDraft: '',
  };
}

function ctrDoctor(targetUrl: string): CtrDoctorItem {
  return {
    id: `ctr-${targetUrl}`,
    title: 'CTR item',
    priority: 'high',
    score: 80,
    targetUrl,
    queryCluster: 'ltx 2.3 prompt examples',
    representativeQueries: ['ltx 2.3 prompt examples'],
    currentMetrics: { clicks: 79, impressions: 378, ctr: 0.209, averagePosition: 5.5 },
    modelFamily: 'LTX',
    detectedIntent: 'prompt_examples',
    issueType: 'expand_defend_good_performer',
    likelyProblem: 'Snippet can be clearer',
    recommendedTitleDirection: 'Mention prompt examples',
    recommendedMetaDescriptionDirection: 'Mention examples',
    recommendedH1SectionDirection: 'Review H1',
    aboveTheFoldRecommendation: 'Review hero',
    currentMetadata: null,
    codexTaskDraft: '',
    acceptanceCriteria: [],
  };
}

function missingContent(targetUrl: string): MissingContentItem {
  return {
    id: `missing-${targetUrl}`,
    priority: 'medium',
    score: 60,
    recommendationType: 'add_examples_block',
    targetUrl,
    likelyPageCandidates: [],
    queryCluster: 'kling ai video examples',
    representativeQueries: ['kling ai video examples'],
    family: 'Kling',
    intent: 'examples',
    currentMetrics: { clicks: 8, impressions: 80, ctr: 0.1, averagePosition: 7 },
    observedGap: 'Examples demand',
    recommendedAction: 'Add examples',
    whyThisAction: 'Useful',
    whyNotCreatePage: null,
    codexTaskDraft: '',
    acceptanceCriteria: [],
  };
}

test('builds curated URL inspection targets from fixed priority routes and SEO signals', () => {
  const targets = buildCuratedUrlInspectionTargets({
    opportunities: [opportunity('https://maxvideoai.com/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast')],
    ctrDoctorItems: [ctrDoctor('https://maxvideoai.com/examples/ltx')],
    missingContentItems: [missingContent('/examples/kling')],
    internalLinkSuggestions: [],
    momentumItems: [],
  });
  const urls = targets.map((target) => target.path);

  assert.ok(urls.includes('/'));
  assert.ok(urls.includes('/models/seedance-2-0'));
  assert.ok(urls.includes('/examples/ltx'));
  assert.ok(urls.includes('/examples/kling'));
  assert.ok(urls.includes('/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast'));
  assert.ok(targets.some((target) => target.sources.includes('manual') && target.path === '/pricing'));
  assert.ok(targets.some((target) => target.sources.includes('opportunity') && target.path.includes('seedance-2-0-vs-seedance-2-0-fast')));
});

test('curated target generation avoids broad sitemap scans', () => {
  const targets = buildCuratedUrlInspectionTargets({
    opportunities: Array.from({ length: 100 }, (_, index) => opportunity(`/models/generated-${index}`)),
    ctrDoctorItems: [],
    missingContentItems: [],
    internalLinkSuggestions: [],
    momentumItems: [],
  });

  assert.ok(targets.length <= 30);
  assert.ok(!targets.some((target) => target.path.includes('generated-99')));
});

test('recent inspection skip logic avoids unnecessary manual API calls', () => {
  assert.equal(
    shouldSkipRecentUrlInspection('2026-04-30T10:00:00.000Z', new Date('2026-04-30T14:00:00.000Z')),
    true
  );
  assert.equal(
    shouldSkipRecentUrlInspection('2026-04-28T10:00:00.000Z', new Date('2026-04-30T14:00:00.000Z')),
    false
  );
  assert.equal(shouldSkipRecentUrlInspection(null, new Date('2026-04-30T14:00:00.000Z')), false);
});

test('normalizes indexed canonical-ok inspection results', () => {
  const item = normalizeUrlInspectionItem({
    target: { path: '/examples/ltx', url: 'https://maxvideoai.com/examples/ltx', group: 'examples', sources: ['manual'] },
    inspectedAt: '2026-04-30T14:00:00.000Z',
    raw: {
      inspectionResultLink: 'https://search.google.com/search-console/inspect',
      indexStatusResult: {
        verdict: 'PASS',
        coverageState: 'Submitted and indexed',
        robotsTxtState: 'ALLOWED',
        indexingState: 'INDEXING_ALLOWED',
        pageFetchState: 'SUCCESSFUL',
        googleCanonical: 'https://maxvideoai.com/examples/ltx',
        userCanonical: 'https://maxvideoai.com/examples/ltx',
        lastCrawlTime: '2026-04-29T12:00:00Z',
        sitemap: ['https://maxvideoai.com/sitemap.xml'],
      },
      richResultsResult: { verdict: 'PASS', detectedItems: [{ richResultType: 'Video' }] },
    },
  });

  assert.equal(item.status, 'indexed_ok');
  assert.equal(item.severity, 'ok');
  assert.equal(item.canonicalMatches, true);
  assert.match(item.suggestedAction, /monitor/i);
  assert.equal(item.sitemapPresent, true);
  assert.equal(item.richResultsStatus, 'PASS');
});

test('detects canonical mismatch and noindex statuses', () => {
  const canonicalMismatch = normalizeUrlInspectionItem({
    target: { path: '/models/ltx-2-3-pro', url: 'https://maxvideoai.com/models/ltx-2-3-pro', group: 'strategic-models', sources: ['manual'] },
    inspectedAt: '2026-04-30T14:00:00.000Z',
    raw: {
      indexStatusResult: {
        verdict: 'PASS',
        coverageState: 'Indexed, not submitted in sitemap',
        robotsTxtState: 'ALLOWED',
        indexingState: 'INDEXING_ALLOWED',
        pageFetchState: 'SUCCESSFUL',
        googleCanonical: 'https://maxvideoai.com/models/ltx-2-3-fast',
        userCanonical: 'https://maxvideoai.com/models/ltx-2-3-pro',
      },
    },
  });
  const noindex = normalizeUrlInspectionItem({
    target: { path: '/pricing', url: 'https://maxvideoai.com/pricing', group: 'core', sources: ['manual'] },
    inspectedAt: '2026-04-30T14:00:00.000Z',
    raw: {
      indexStatusResult: {
        verdict: 'FAIL',
        coverageState: 'Excluded by noindex tag',
        robotsTxtState: 'ALLOWED',
        indexingState: 'BLOCKED_BY_META_TAG',
        pageFetchState: 'SUCCESSFUL',
      },
    },
  });

  assert.equal(canonicalMismatch.status, 'indexed_canonical_mismatch');
  assert.equal(canonicalMismatch.severity, 'warning');
  assert.match(canonicalMismatch.suggestedAction, /canonical|internal links/i);
  assert.equal(noindex.status, 'noindex');
  assert.equal(noindex.severity, 'critical');
});

test('maps fetch and coverage problems to clean statuses', () => {
  assert.equal(normalizeUrlInspectionItem({
    target: { path: '/missing', url: 'https://maxvideoai.com/missing', group: 'manual', sources: ['manual'] },
    inspectedAt: '2026-04-30T14:00:00.000Z',
    raw: { indexStatusResult: { verdict: 'FAIL', pageFetchState: 'NOT_FOUND', coverageState: 'Not found (404)' } },
  }).status, 'not_found');

  assert.equal(normalizeUrlInspectionItem({
    target: { path: '/robots', url: 'https://maxvideoai.com/robots', group: 'manual', sources: ['manual'] },
    inspectedAt: '2026-04-30T14:00:00.000Z',
    raw: { indexStatusResult: { verdict: 'FAIL', pageFetchState: 'BLOCKED_ROBOTS_TXT', robotsTxtState: 'DISALLOWED' } },
  }).status, 'blocked_by_robots');

  assert.equal(normalizeUrlInspectionItem({
    target: { path: '/draft', url: 'https://maxvideoai.com/draft', group: 'manual', sources: ['manual'] },
    inspectedAt: '2026-04-30T14:00:00.000Z',
    raw: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: 'Discovered - currently not indexed' } },
  }).status, 'discovered_not_indexed');
});

test('URL Inspection export markdown and JSON shape are stable', () => {
  const items = [
    normalizeUrlInspectionItem({
      target: { path: '/', url: 'https://maxvideoai.com/', group: 'core', sources: ['manual'] },
      inspectedAt: '2026-04-30T14:00:00.000Z',
      raw: { indexStatusResult: { verdict: 'PASS', pageFetchState: 'SUCCESSFUL', indexingState: 'INDEXING_ALLOWED' } },
    }),
  ];
  const markdown = formatUrlInspectionSectionMarkdown(items);
  const payload = { urlInspectionItems: items };

  assert.match(markdown, /# URL Inspection/);
  assert.equal(Array.isArray(payload.urlInspectionItems), true);
  assert.equal(payload.urlInspectionItems[0]?.path, '/');
});

test('URL Inspection JSON export strips Search Console inspection resource links', () => {
  const items = [
    normalizeUrlInspectionItem({
      target: { path: '/', url: 'https://maxvideoai.com/', group: 'core', sources: ['manual'] },
      inspectedAt: '2026-04-30T14:00:00.000Z',
      raw: {
        inspectionResultLink: 'https://search.google.com/search-console/inspect?resource_id=sc-domain:maxvideoai.com&id=abc',
        indexStatusResult: { verdict: 'PASS', pageFetchState: 'SUCCESSFUL', indexingState: 'INDEXING_ALLOWED' },
      },
    }),
  ];
  const sanitized = sanitizeUrlInspectionItemsForExport(items);
  const json = JSON.stringify({ urlInspectionItems: sanitized });

  assert.equal(sanitized[0]?.inspectionResultLink, null);
  assert.equal((sanitized[0]?.raw as { inspectionResultLink?: string }).inspectionResultLink, undefined);
  assert.equal(json.includes('resource_id=sc-domain:maxvideoai.com'), false);
});
