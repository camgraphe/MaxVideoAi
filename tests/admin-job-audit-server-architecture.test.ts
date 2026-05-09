import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const facadePath = join(root, 'frontend/server/admin-job-audit.ts');
const modulesDir = join(root, 'frontend/server/admin-job-audit');
const modules = [
  'cursor.ts',
  'mapper.ts',
  'normalizers.ts',
  'outcomes.ts',
  'query-builder.ts',
  'runner.ts',
  'types.ts',
];

const facadeSource = readFileSync(facadePath, 'utf8');

function readModule(moduleName: string): string {
  return readFileSync(join(modulesDir, moduleName), 'utf8');
}

test('admin job audit public module stays a thin facade', () => {
  assert.ok(existsSync(facadePath), 'admin-job-audit facade should exist');
  assert.match(facadeSource, /from '\.\/admin-job-audit\/runner'/);
  assert.match(facadeSource, /from '\.\/admin-job-audit\/types'/);

  const lineCount = facadeSource.split('\n').length;
  assert.ok(lineCount <= 20, `admin-job-audit.ts should stay below 20 lines, got ${lineCount}`);
});

test('admin job audit server responsibilities live in focused modules', () => {
  for (const moduleName of modules) {
    const modulePath = join(modulesDir, moduleName);
    assert.ok(existsSync(modulePath), `${moduleName} should exist under server/admin-job-audit`);
    const lineCount = readModule(moduleName).split('\n').length;
    assert.ok(lineCount <= 260, `${moduleName} should stay below 260 lines, got ${lineCount}`);
  }
});

test('admin job audit facade does not regain query, mapping, or outcome ownership', () => {
  for (const pattern of [
    /type RawJobAuditRow/,
    /function deriveOutcome\(/,
    /function buildOutcomeSqlCondition\(/,
    /function parseCursorParam\(/,
    /function normalizeTimeline\(/,
    /SELECT\s+j\.id/,
    /fal_queue_log/,
    /normalizeMediaUrl/,
  ]) {
    assert.doesNotMatch(facadeSource, pattern);
  }
});

test('admin job audit focused modules expose the expected contracts', () => {
  assert.match(readModule('types.ts'), /export type AdminJobAuditRecord/);
  assert.match(readModule('normalizers.ts'), /export function normalizeAuditText/);
  assert.match(readModule('normalizers.ts'), /export function findFirstTextByKeys/);
  assert.match(readModule('outcomes.ts'), /export function deriveOutcome/);
  assert.match(readModule('outcomes.ts'), /export function buildOutcomeSqlCondition/);
  assert.match(readModule('cursor.ts'), /export function parseCursorParam/);
  assert.match(readModule('cursor.ts'), /export function formatCursorValue/);
  assert.match(readModule('mapper.ts'), /export function mapJobAuditRow/);
  assert.match(readModule('mapper.ts'), /export function normalizeTimeline/);
  assert.match(readModule('query-builder.ts'), /export function buildJobAuditWhereClause/);
  assert.match(readModule('runner.ts'), /export async function fetchRecentJobAudits/);
});
