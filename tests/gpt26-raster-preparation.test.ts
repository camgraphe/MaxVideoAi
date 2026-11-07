import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

test('offline preparation writes two reviewable native imports without credentials and has no apply action', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'gpt26-raster-review-'));
  const output = join(parent, 'new-review');
  const run = (args: string[]) => spawnSync(process.execPath, [
    '--import', 'tsx', 'frontend/scripts/prepare-gpt26-raster-tariffs.ts', ...args,
  ], { encoding: 'utf8', env: { ...process.env, TSX_TSCONFIG_PATH: 'frontend/tsconfig.json',
    DATABASE_URL: '', OPENAI_API_KEY: '', FAL_KEY: '', PRICING_ADMIN_BATCHES_ENABLED: '0' } });
  try {
    const result = run(['--out', output]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual((await readdir(output)).sort(), ['gpt-image-2-6-flare-raster.json', 'gpt-image-2-6-sunburst-raster.json', 'review.json']);
    const report = JSON.parse(await readFile(join(output, 'review.json'), 'utf8'));
    assert.equal(report.status, 'offline_proposal_not_applied');
    assert.equal(report.currentDatabaseRevision, null);
    assert.equal(report.newClasses, 48);
    assert.equal(report.envelope.checkedDimensions, 29146);
    for (const batch of report.batches) {
      const content = await readFile(join(output, batch.file), 'utf8');
      assert.equal(createHash('sha256').update(content).digest('hex'), batch.sha256);
      const proposal = JSON.parse(content);
      assert.equal(proposal.intent, 'create_missing');
      assert.equal(proposal.selections.length, 24);
      assert.ok(proposal.selections.every((entry: { selector: { durationSec: string } }) => entry.selector.durationSec === 'continuous'));
    }
    const fourthousand = report.examples.filter((entry: { resolution: string }) => ['3840x2160', '2160x3840'].includes(entry.resolution));
    assert.equal(fourthousand.length, 4);
    assert.ok(fourthousand.every((entry: { proposedCustomerCents: number }) => entry.proposedCustomerCents === 17));
    assert.notEqual(run(['--out', output]).status, 0, 'existing review files are never overwritten');
    assert.notEqual(run(['apply', '--out', join(parent, 'forbidden')]).status, 0);
    assert.deepEqual(await readdir(parent), ['new-review']);
  } finally { await rm(parent, { recursive: true, force: true }); }
});
