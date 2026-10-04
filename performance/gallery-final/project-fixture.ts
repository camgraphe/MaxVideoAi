import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { build } from 'esbuild';

async function main() {
  const [baselinePath, candidatePath, outputPath] = process.argv.slice(2);
  if (!baselinePath || !candidatePath || !outputPath) throw new Error('Usage: project-fixture.ts BASELINE CANDIDATE OUTPUT');
  const fixturePath = resolve(__dirname, 'fixture/public-examples.json');
  const fixture = readFileSync(fixturePath);
  const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8'));
  assert.equal(createHash('sha256').update(fixture).digest('hex'), manifest.snapshotSha256);
  const snapshot = JSON.parse(fixture.toString());
  const folder = mkdtempSync(resolve(tmpdir(), 'gallery-api-projection-'));
  const requireBundle = createRequire(__filename);
  const versions: Record<string, unknown> = {};
  try {
    for (const [variant, checkoutPath] of [['baseline', baselinePath], ['candidate', candidatePath]]) {
      const checkout = resolve(checkoutPath);
      const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
      if (variant === 'baseline') assert.equal(commit, manifest.baselineCommit);
      execFileSync('git', ['diff', '--quiet', 'HEAD', '--', 'frontend/config', 'frontend/lib', 'frontend/src/lib'], { cwd: checkout });
      const outfile = resolve(folder, `${variant}.cjs`);
      await build({
        stdin: { contents: "export {getDiscoverableExampleEngineAliases} from '@/lib/examples/discovery';", resolveDir: resolve(checkout, 'frontend') },
        bundle: true, platform: 'node', format: 'cjs', outfile, tsconfig: resolve(checkout, 'frontend/tsconfig.json'),
      });
      const aliases = new Set<string>(requireBundle(outfile).getDiscoverableExampleEngineAliases());
      const hub = snapshot.feeds[''].playlist.filter((id: string) => aliases.has(snapshot.cards[id].engineIconId.toLowerCase()));
      const excluded = snapshot.feeds[''].playlist.filter((id: string) => !hub.includes(id));
      versions[variant] = { commit, hub, wan: snapshot.feeds.wan.playlist, excluded,
        excludedModels: [...new Set(excluded.map((id: string) => snapshot.cards[id].engineIconId))] };
      console.log(JSON.stringify({ variant, commit, hub: hub.length, wan: snapshot.feeds.wan.playlist.length, excluded: excluded.length,
        excludedModels: (versions[variant] as { excludedModels: string[] }).excludedModels }));
    }
    const baseline = versions.baseline as { hub: string[] };
    const candidate = versions.candidate as { hub: string[] };
    assert.equal(baseline.hub.length, 251, 'Pinned main projection changed unexpectedly');
    assert.equal(candidate.hub.length, manifest.hub, 'Candidate projection must retain the full captured hub');
    assert.deepEqual(baseline.hub.slice(0, 24), candidate.hub.slice(0, 24), 'Compared first page must have identical media');
    writeFileSync(resolve(outputPath), JSON.stringify({ snapshotSha256: manifest.snapshotSha256, versions }, null, 2) + '\n');
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
