import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildExpectedVideoCanonicalUrl } from '../frontend/lib/video-seo-canonical.ts';
import { buildVideoSeoAuditReport } from '../frontend/server/video-seo-audit.ts';

const root = process.cwd();
const auditScriptPath = join(root, 'frontend/scripts/seo/video-watch-pages-audit.ts');

function sourceRow(overrides: Record<string, unknown> = {}) {
  return {
    videoId: 'job_test',
    seoStatus: 'approved',
    isEligible: true,
    canonicalUrl: buildExpectedVideoCanonicalUrl('job_test'),
    videoObjectPresent: true,
    stableThumbnailUrl: true,
    stableVideoUrl: true,
    internalLinkCount: 4,
    editorialQaErrors: [],
    technicalEligibilityBlockers: [],
    ...overrides,
  };
}

test('video SEO audit report exposes canonical, sitemap, media, links, and classification fields', () => {
  const report = buildVideoSeoAuditReport([sourceRow()]);
  assert.equal(report.summary.total, 1);
  assert.equal(report.rows[0].classification, 'keep_indexable');
  assert.equal(report.rows[0].robots, 'index, follow');
  assert.equal(report.rows[0].canonicalUrl, 'https://maxvideoai.com/video/job_test');
  assert.equal(report.rows[0].expectedCanonicalUrl, 'https://maxvideoai.com/video/job_test');
  assert.equal(report.rows[0].sitemapIncluded, true);
  assert.equal(report.rows[0].videoSitemapIncluded, true);
  assert.equal(report.rows[0].videoObjectPresent, true);
  assert.equal(report.rows[0].mediaGateResult, 'pass');
  assert.equal(report.rows[0].internalLinkCount, 4);
  assert.deepEqual(report.rows[0].blockers, []);
});

test('video SEO audit report classifies enrichment, deindex, and canonical conflicts', () => {
  const report = buildVideoSeoAuditReport([
    sourceRow({
      videoId: 'job_enrich',
      seoStatus: 'needs_edits',
      isEligible: false,
      canonicalUrl: buildExpectedVideoCanonicalUrl('job_enrich'),
      videoObjectPresent: false,
      stableThumbnailUrl: true,
      stableVideoUrl: true,
      internalLinkCount: 2,
      editorialQaErrors: ['Missing editorial field: h1.'],
    }),
    sourceRow({
      videoId: 'job_deindex',
      seoStatus: 'disabled',
      isEligible: false,
      canonicalUrl: buildExpectedVideoCanonicalUrl('job_deindex'),
      videoObjectPresent: false,
      stableThumbnailUrl: false,
      stableVideoUrl: true,
      internalLinkCount: 0,
      technicalEligibilityBlockers: ['Stable public thumbnail asset is required.'],
    }),
    sourceRow({
      videoId: 'job_conflict',
      seoStatus: 'approved',
      isEligible: false,
      canonicalUrl: buildExpectedVideoCanonicalUrl('job_test'),
      canonicalConflictIds: ['job_test'],
      videoObjectPresent: false,
      stableThumbnailUrl: true,
      stableVideoUrl: true,
      internalLinkCount: 3,
    }),
  ]);

  assert.equal(report.rows.find((row) => row.videoId === 'job_enrich')?.classification, 'needs_enrichment');
  assert.equal(report.rows.find((row) => row.videoId === 'job_deindex')?.classification, 'deindex');
  assert.equal(report.rows.find((row) => row.videoId === 'job_conflict')?.classification, 'duplicate_or_conflict');
  assert.equal(report.rows.find((row) => row.videoId === 'job_enrich')?.videoSitemapIncluded, false);
});

test('video SEO audit script is wired to the existing watch-page SEO flow', () => {
  assert.ok(existsSync(auditScriptPath), 'video SEO audit script should exist');
  const source = readFileSync(auditScriptPath, 'utf8');
  assert.match(source, /listVideoSeoAuditSourceRows/, 'script should audit watch-page SEO source rows');
  assert.match(source, /buildVideoSeoAuditReport/, 'script should build the shared audit report');
  assert.match(source, /keep_indexable|needs_enrichment|deindex|duplicate_or_conflict/, 'script should print migration classes');
});
