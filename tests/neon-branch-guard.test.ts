import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

test('Neon branch guard scripts are wired into package.json', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['neon:branches:check'], 'node scripts/neon-branch-guard.mjs');
  assert.equal(pkg.scripts['neon:branches:prune'], 'node scripts/neon-branch-guard.mjs --delete-archived');
});

test('Neon branch guard delegates deletion to the completed-preview policy', () => {
  const source = readFileSync(join(root, 'scripts/neon-branch-guard.mjs'), 'utf8');
  assert.match(source, /const DEFAULT_BRANCH_LIMIT = 8/);
  assert.match(source, /const DEFAULT_DELETE_PATTERN = '\^preview\/codex\/'/);
  assert.match(source, /findCompletedPreviewCandidates/);
  assert.match(source, /freshCandidates/);
  assert.match(source, /NEON_API_KEY/);
  assert.doesNotMatch(source, /console\.(log|error)\([^)]*token/i);
});

test('Neon branch guard runs daily in GitHub Actions', () => {
  const workflow = readFileSync(join(root, '.github/workflows/neon-branch-guard.yml'), 'utf8');
  assert.match(workflow, /name: Neon Branch Guard/);
  assert.match(workflow, /cron: '17 5 \* \* \*'/);
  assert.match(workflow, /NEON_API_KEY: \$\{\{ secrets\.NEON_API_KEY \}\}/);
  assert.match(workflow, /NEON_BRANCH_LIMIT: '8'/);
  assert.match(workflow, /node scripts\/neon-branch-guard\.mjs --delete-merged/);
  assert.match(workflow, /pull-requests: read/);
});
