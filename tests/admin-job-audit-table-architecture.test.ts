import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const tablePath = join(root, 'frontend/components/admin/JobAuditTable.tsx');
const rowsPath = join(root, 'frontend/components/admin/job-audit/JobAuditRows.tsx');
const detailsPath = join(root, 'frontend/components/admin/job-audit/JobAuditExpandedDetails.tsx');
const formattersPath = join(root, 'frontend/components/admin/job-audit/job-audit-formatters.tsx');

const tableSource = readFileSync(tablePath, 'utf8');
const rowsSource = readFileSync(rowsPath, 'utf8');
const detailsSource = readFileSync(detailsPath, 'utf8');
const formattersSource = readFileSync(formattersPath, 'utf8');

test('admin job audit table delegates row rendering, detail cards, and formatting', () => {
  for (const file of [tablePath, rowsPath, detailsPath, formattersPath]) {
    assert.ok(existsSync(file), `${file} should exist`);
  }

  assert.match(tableSource, /from '@\/components\/admin\/job-audit\/JobAuditRows'/);
  assert.doesNotMatch(tableSource, /new Intl\.DateTimeFormat/, 'date formatting belongs in job-audit-formatters.tsx');
  assert.doesNotMatch(tableSource, /function DetailCard/, 'expanded cards belong in JobAuditExpandedDetails.tsx');
  assert.doesNotMatch(tableSource, /function IntegrityPill/, 'integrity pills belong in JobAuditExpandedDetails.tsx');
  assert.doesNotMatch(tableSource, /visibleJobs\.map/, 'row rendering belongs in JobAuditRows.tsx');

  const lineCount = tableSource.split('\n').length;
  assert.ok(lineCount <= 330, `AdminJobAuditTable should stay below 330 lines after row extraction, got ${lineCount}`);
});

test('admin job audit helper modules expose the expected contract', () => {
  assert.match(rowsSource, /export function JobAuditRows/);
  assert.match(rowsSource, /JobAuditExpandedDetails/);
  assert.match(tableSource, /showHidden/, 'admin audit table should keep user-hidden rows behind an explicit toggle');
  assert.match(tableSource, /Show hidden/, 'admin audit table should label the user-hidden rows toggle clearly');
  assert.match(rowsSource, /Hidden by user/, 'admin audit rows should flag user-hidden jobs');
  assert.match(detailsSource, /export function IntegrityPill/);
  assert.match(detailsSource, /export function JobAuditExpandedDetails/);
  assert.match(detailsSource, /User-hidden/, 'expanded audit details should preserve the user opt-out signal');

  for (const exportName of ['formatCurrency', 'formatDate', 'outcomeMeta', 'technicalStatusBadge', 'displayMeta']) {
    assert.match(formattersSource, new RegExp(`export function ${exportName}\\b`), `${exportName} should be exported`);
  }
});
