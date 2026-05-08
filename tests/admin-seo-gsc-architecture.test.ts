import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'frontend/app/(core)/admin/seo/gsc/page.tsx';
const viewPath = 'frontend/app/(core)/admin/seo/gsc/_components/GscDashboardView.tsx';

test('admin SEO GSC page stays a route orchestrator', () => {
  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(viewPath), true);

  const pageSource = readFileSync(pagePath, 'utf8');
  const pageLines = pageSource.split('\n').length;

  assert.ok(pageLines < 60, `expected SEO GSC page to stay under 60 lines, got ${pageLines}`);
  assert.match(pageSource, /from '\.\/_components\/GscDashboardView';/);
  assert.match(pageSource, /fetchGscDashboardData\(/);
  assert.match(pageSource, /normalizeGscRange\(/);
  assert.doesNotMatch(pageSource, /<AdminPageHeader/);
  assert.doesNotMatch(pageSource, /function buildMetricItems/);
  assert.doesNotMatch(pageSource, /new Intl\./);
});

test('admin SEO GSC view owns dashboard rendering', () => {
  const viewSource = readFileSync(viewPath, 'utf8');

  assert.match(viewSource, /export function GscDashboardView/);
  assert.match(viewSource, /function buildMetricItems/);
  assert.match(viewSource, /function TrendPanel/);
  assert.match(viewSource, /function PerformanceTable/);
  assert.match(viewSource, /const numberFormatter = new Intl\.NumberFormat/);
});
