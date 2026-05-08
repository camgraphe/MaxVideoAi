import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'frontend/app/(core)/admin/engines/page.tsx';
const viewPath = 'frontend/app/(core)/admin/engines/_components/AdminEnginesView.tsx';
const viewModelPath = 'frontend/app/(core)/admin/engines/_lib/admin-engines-view-model.ts';

test('admin engines page stays a route orchestrator', () => {
  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(viewPath), true);
  assert.equal(existsSync(viewModelPath), true);

  const pageSource = readFileSync(pagePath, 'utf8');
  const pageLines = pageSource.split('\n').length;

  assert.ok(pageLines < 60, `expected admin engines page to stay under 60 lines, got ${pageLines}`);
  assert.match(pageSource, /from '\.\/_components\/AdminEnginesView';/);
  assert.match(pageSource, /from '\.\/_lib\/admin-engines-view-model';/);
  assert.match(pageSource, /requireAdmin\(\)/);
  assert.match(pageSource, /loadAdminEnginesViewModel\(/);
  assert.doesNotMatch(pageSource, /new Intl\./);
  assert.doesNotMatch(pageSource, /fetchEnginePerformanceMetrics/);
  assert.doesNotMatch(pageSource, /<AdminSection/);
  assert.doesNotMatch(pageSource, /function buildOperationalRows/);
});

test('admin engines view model owns data loading, formatting, and row builders', () => {
  const viewModelSource = readFileSync(viewModelPath, 'utf8');

  assert.match(viewModelSource, /export async function loadAdminEnginesViewModel/);
  assert.match(viewModelSource, /fetchEnginePerformanceMetrics\(/);
  assert.match(viewModelSource, /fetchEngineUsageMetrics\(/);
  assert.match(viewModelSource, /ensureEngineSettingsSeed\(/);

  for (const exportName of [
    'buildInitialForm',
    'buildBaseline',
    'buildConfigSnapshot',
    'buildOverviewCards',
    'buildOperationalRows',
    'buildCommercialRows',
    'summarizeConfig',
    'needsConfigAttention',
    'formatCurrency',
    'formatDuration',
  ]) {
    assert.match(viewModelSource, new RegExp(`export function ${exportName}\\(`), `${exportName} should be exported`);
  }
});

test('admin engines view owns dashboard sections and table columns', () => {
  const viewSource = readFileSync(viewPath, 'utf8');

  assert.match(viewSource, /export function AdminEnginesView/);
  assert.match(viewSource, /function buildOperationalColumns/);
  assert.match(viewSource, /function buildCommercialColumns/);
  assert.match(viewSource, /function AdminEngineConfigurationPanel/);
  assert.match(viewSource, /function ConfigInlineSummary/);
  assert.match(viewSource, /<AdminSection/);
  assert.match(viewSource, /<EngineSettingsPanel/);
  assert.match(viewSource, /from '\.\.\/_lib\/admin-engines-view-model';/);
  assert.doesNotMatch(viewSource, /fetchEnginePerformanceMetrics/);
  assert.doesNotMatch(viewSource, /ensureEngineSettingsSeed/);
});
