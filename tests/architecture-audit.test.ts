import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const scriptPath = 'scripts/audit-large-files.mjs';

test('large file audit emits JSON rows sorted by size', () => {
  const output = execFileSync('node', [scriptPath, '--json', '--min-lines', '500'], {
    encoding: 'utf8',
  });
  const rows = JSON.parse(output) as Array<{ file: string; lines: number }>;

  assert.ok(rows.length > 0);
  assert.equal(rows.some((row) => row.file.startsWith('frontend/')), true);
  assert.equal(rows.every((row) => row.lines >= 500), true);
  assert.deepEqual(
    rows.map((row) => row.lines),
    [...rows.map((row) => row.lines)].sort((a, b) => b - a)
  );
});

test('large file audit help documents threshold and JSON output', () => {
  const output = execFileSync('node', [scriptPath, '--help'], {
    encoding: 'utf8',
  });

  assert.match(output, /--min-lines/);
  assert.match(output, /--json/);
});
