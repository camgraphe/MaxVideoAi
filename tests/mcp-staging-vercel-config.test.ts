import assert from 'node:assert/strict';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const REQUIRED_OPERATIONAL_ENVIRONMENT = [
  'MCP_STAGING_OPERATIONAL_ENABLED',
  'BYTEPLUS_ARK_ENABLED',
  'BYTEPLUS_ARK_API_KEY',
  'SEEDANCE_2_5_BYTEPLUS_ENABLED',
  'SEEDANCE_2_5_PROVIDER',
  'SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY',
  'SEEDANCE_2_5_BYTEPLUS_MODES',
] as const;

function runGit(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

function createDeployFixture(): string {
  const fixture = mkdtempSync(join(tmpdir(), 'mcp-staging-deploy-test-'));
  mkdirSync(join(fixture, 'frontend'), { recursive: true });
  mkdirSync(join(fixture, 'packages/pricing'), { recursive: true });
  mkdirSync(join(fixture, 'scripts'), { recursive: true });
  copyFileSync(
    join(process.cwd(), 'frontend/vercel.mcp-staging.json'),
    join(fixture, 'frontend/vercel.mcp-staging.json'),
  );
  copyFileSync(
    join(process.cwd(), 'packages/pricing/package.json'),
    join(fixture, 'packages/pricing/package.json'),
  );
  copyFileSync(
    join(process.cwd(), 'scripts/deploy-mcp-staging-vercel.sh'),
    join(fixture, 'scripts/deploy-mcp-staging-vercel.sh'),
  );
  runGit(fixture, ['init', '--quiet']);
  runGit(fixture, ['config', 'user.email', 'test@example.invalid']);
  runGit(fixture, ['config', 'user.name', 'MCP deploy test']);
  runGit(fixture, ['add', '.']);
  runGit(fixture, ['commit', '--quiet', '-m', 'fixture']);
  return fixture;
}

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
  for (const name of REQUIRED_OPERATIONAL_ENVIRONMENT) {
    assert.match(script, new RegExp(`['"]${name}['"]`));
  }
  assert.match(script, /\/v10\/projects\/\$\{STAGING_PROJECT\}\/env\?decrypt=false&target=production/);
  assert.match(script, /\{[\s\S]{0,80}key,[\s\S]{0,80}target:/);
  assert.match(script, /CREDENTIAL_BLOCKED/);
  assert.ok(
    script.indexOf('assert_staging_operational_environment') < script.indexOf('"${VERCEL[@]}" deploy'),
    'the sanitized environment metadata gate must run before deployment',
  );
  assert.doesNotMatch(script, /env pull/);
  assert.doesNotMatch(script, /\$\{?BYTEPLUS_ARK_API_KEY/);
  assert.match(script, /git .*archive HEAD/);
  assert.match(script, /vercel\.mcp-staging\.json/);
  assert.match(script, /--prod/);
  assert.match(script, /--skip-domain/);
  assert.match(script, /crons/);
  assert.match(script, /has\("crons"\)/);
  assert.match(script, /\.crons \| type == "array"/);
  assert.match(script, /noindex, nofollow, noarchive/);
  assert.match(script, /oauth-protected-resource\/mcp/);
  assert.match(script, /assert_exact_robots_header\(\)/);
  assert.match(
    script,
    /assert_protocol_endpoints "\$CANDIDATE_URL" "\$ARTIFACTS\/candidate-protocol" candidate/,
  );
  assert.match(
    script,
    /assert_protocol_endpoints "https:\/\/\$\{STABLE_HOST\}" "\$ARTIFACTS\/stable-protocol" stable/,
  );
  assert.match(script, /promote/);
  assert.match(script, /select\(\.name == \$name\) \| \.id/);
  assert.match(script, /select\([\s\S]*\.readyState == "READY"[\s\S]*\) \| \.id/);
  assert.doesNotMatch(script, /\.name == \$name and \.id/);
  assert.match(script, /rm -f "\$TEMP_ROOT\/\.env\.local"/);
  assert.match(script, /--meta[\s\S]*mcpApprovedGitSha/);
  assert.match(script, /--meta[\s\S]*mcpTrackedArchiveSha256/);
  assert.match(script, /\.meta\.mcpApprovedGitSha == \$approved_head/);
  assert.match(script, /\.meta\.mcpTrackedArchiveSha256 == \$archive_sha256/);
  assert.ok(
    script.indexOf('--skip-domain') < script.indexOf('promote'),
    'the candidate must remain unaliased until after verification',
  );
  assert.ok(
    script.indexOf('assert_protocol_endpoints "$CANDIDATE_URL"') < script.indexOf('"${VERCEL[@]}" promote'),
    'the candidate MCP protocol headers must be verified before promotion',
  );
  assert.doesNotMatch(script, /vercel deploy frontend/);
  assert.doesNotMatch(script, /--local-config/);
  assert.ok(
    script.indexOf('.meta.mcpApprovedGitSha') < script.indexOf('promote'),
    'candidate provenance must be checked before promotion',
  );

  const deploymentRefFilter = script.match(/^DEPLOYMENT_REF_FILTER='([^']+)'$/m)?.[1];
  assert.ok(deploymentRefFilter, 'the deploy wrapper must define its Vercel output parser once');
  for (const payload of [
    { url: 'direct-candidate.vercel.app' },
    {
      status: 'ok',
      deployment: { url: 'agent-candidate.vercel.app' },
      message: 'Deployment ready.',
    },
  ]) {
    const parsed = spawnSync('jq', ['-er', deploymentRefFilter], {
      encoding: 'utf8',
      input: JSON.stringify(payload),
    });
    assert.equal(parsed.status, 0, parsed.stderr);
    assert.match(parsed.stdout.trim(), /-candidate\.vercel\.app$/);
  }

  const fixture = createDeployFixture();
  const fixtureScript = join(fixture, 'scripts/deploy-mcp-staging-vercel.sh');
  try {
    const dryRun = spawnSync('bash', [fixtureScript, '--dry-run'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.match(
      dryRun.stdout,
      /^SAFE_PACKAGE_OK project=maxvideoai-mcp-staging scope=camgraphes-projects tracked_head=[0-9a-f]+ mode=new-candidate\n$/,
    );
    assert.equal(dryRun.stderr, '');

    const resumeDryRun = spawnSync(
      'bash',
      [fixtureScript, '--candidate', 'dpl_E8nXLZ2WH6jrmrvcm5AnBzdKoZos', '--dry-run'],
      { cwd: fixture, encoding: 'utf8' },
    );
    assert.equal(resumeDryRun.status, 0, resumeDryRun.stderr);
    assert.match(resumeDryRun.stdout, /mode=existing-candidate/);
    assert.match(resumeDryRun.stdout, /candidate=dpl_E8nXLZ2WH6jrmrvcm5AnBzdKoZos/);

    writeFileSync(join(fixture, 'untracked-change.txt'), 'dirty\n');
    const dirtyDryRun = spawnSync('bash', [fixtureScript, '--dry-run'], {
      cwd: fixture,
      encoding: 'utf8',
    });
    assert.equal(dirtyDryRun.status, 65);
    assert.doesNotMatch(dirtyDryRun.stdout, /SAFE_PACKAGE_OK/);
    assert.match(dirtyDryRun.stderr, /untracked files/i);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }

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
    assert.match(document, /mcpApprovedGitSha/);
    assert.match(document, /mcpTrackedArchiveSha256/);
  }

  for (const setting of [
    'MCP_STAGING_OPERATIONAL_ENABLED=true',
    'BYTEPLUS_ARK_ENABLED=true',
    'SEEDANCE_2_5_BYTEPLUS_ENABLED=true',
    'SEEDANCE_2_5_PROVIDER=byteplus_modelark',
    'SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY=false',
    'SEEDANCE_2_5_BYTEPLUS_MODES=t2v,i2v,ref2v,v2v,extend',
  ]) {
    assert.match(runbook, new RegExp(`^${setting}$`, 'm'));
  }
  assert.match(runbook, /BYTEPLUS_ARK_API_KEY[\s\S]{0,400}dedicated staging credential/i);
  assert.match(runbook, /CREDENTIAL_BLOCKED/);
  assert.match(runbook, /migration 37[\s\S]{0,400}(?:before|prerequisite)/i);
  assert.match(runbook, /zero cron|zero-cron/i);
  assert.doesNotMatch(runbook, /BYTEPLUS_ARK_API_KEY\s*=/);
});
