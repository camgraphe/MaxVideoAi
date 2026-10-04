import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const adminSeoRoot = 'frontend/app/(core)/admin/seo';
const oldPages = [
  'actions',
  'cockpit',
  'ctr-doctor',
  'gsc',
  'internal-links',
  'missing-content',
  'momentum',
  'page-actions',
  'url-inspection',
];
const oldActions = [
  'gsc/refresh',
  'url-inspection/inspect',
  'actions/export',
];

test('retired admin SEO pages lead to one external Search Console entry', () => {
  const landing = readFileSync(`${adminSeoRoot}/page.tsx`, 'utf8');
  assert.match(landing, /https:\/\/search\.google\.com\/search-console/);
  assert.match(landing, /\/admin\/video-seo/);

  for (const page of oldPages) {
    const source = readFileSync(`${adminSeoRoot}/${page}/page.tsx`, 'utf8');
    assert.match(source, /redirect\('\/admin\/seo'\)/, page);
    assert.doesNotMatch(source, /fetch(GscDashboardData|SeoCockpitData|UrlInspectionDashboardData)/, page);
  }
});

test('retired admin SEO actions preserve auth but cannot call Google', () => {
  for (const action of oldActions) {
    const source = readFileSync(`frontend/app/api/admin/seo/${action}/route.ts`, 'utf8');
    assert.match(source, /requireAdmin\(req\)/, action);
    assert.match(source, /status: 410/, action);
    assert.doesNotMatch(source, /fetchGscDashboardData|inspectCuratedUrls|fetchSeoCockpitData/, action);
  }
  assert.equal(existsSync('frontend/server/seo/gsc/client.ts'), false);
});
