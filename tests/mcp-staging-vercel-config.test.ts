import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('MCP staging Vercel config has no crons and blocks indexing', () => {
  const path = join(process.cwd(), 'frontend/vercel.mcp-staging.json');
  assert.equal(existsSync(path), true);
  const config = JSON.parse(readFileSync(path, 'utf8')) as {
    crons?: unknown[];
    headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  };
  assert.equal(config.crons, undefined);
  assert.deepEqual(config.headers, [
    {
      source: '/(.*)',
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
    },
  ]);
});

test('MCP staging deploy wrapper gates an unaliased candidate before promotion', () => {
  const scriptPath = join(process.cwd(), 'scripts/deploy-mcp-staging-vercel.sh');
  assert.equal(existsSync(scriptPath), true, 'the reviewed staging deploy wrapper must exist');

  const script = readFileSync(scriptPath, 'utf8');
  assert.match(script, /STAGING_PROJECT=['"]maxvideoai-mcp-staging['"]/);
  assert.match(script, /PRODUCTION_PROJECT=['"]maxvideoai['"]/);
  assert.match(script, /STAGING_SCOPE=['"]camgraphes-projects['"]/);
  assert.match(script, /git .*archive HEAD/);
  assert.match(script, /vercel\.mcp-staging\.json/);
  assert.match(script, /--prod/);
  assert.match(script, /--skip-domain/);
  assert.match(script, /crons/);
  assert.match(script, /has\("crons"\)/);
  assert.match(script, /\.crons \| type == "array"/);
  assert.match(script, /noindex, nofollow, noarchive/);
  assert.match(script, /oauth-protected-resource\/mcp/);
  assert.match(script, /promote/);
  assert.match(script, /select\(\.name == \$name\) \| \.id/);
  assert.match(script, /select\([\s\S]*\.readyState == "READY"[\s\S]*\) \| \.id/);
  assert.doesNotMatch(script, /\.name == \$name and \.id/);
  assert.match(script, /rm -f "\$TEMP_ROOT\/\.env\.local"/);
  assert.ok(
    script.indexOf('--skip-domain') < script.indexOf('promote'),
    'the candidate must remain unaliased until after verification',
  );
  assert.doesNotMatch(script, /vercel deploy frontend/);
  assert.doesNotMatch(script, /--local-config/);

  const dryRun = spawnSync('bash', [scriptPath, '--dry-run'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /SAFE_PACKAGE_OK/);
  assert.match(dryRun.stdout, /project=maxvideoai-mcp-staging/);
  assert.match(dryRun.stdout, /scope=camgraphes-projects/);

  const plan = readFileSync(
    join(process.cwd(), 'docs/superpowers/plans/2026-07-11-mcp-hosted-staging-claude-desktop.md'),
    'utf8',
  );
  const runbook = readFileSync(join(process.cwd(), 'docs/operations/mcp-staging-deployment.md'), 'utf8');
  for (const document of [plan, runbook]) {
    assert.match(document, /scripts\/deploy-mcp-staging-vercel\.sh/);
    assert.doesNotMatch(
      document,
      /vercel deploy frontend[\s\S]{0,160}--local-config frontend\/vercel\.mcp-staging\.json/,
    );
  }
});
