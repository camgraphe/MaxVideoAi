import assert from 'node:assert/strict';
import {
  chmodSync,
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
  'MCP_STAGING_REFERENCE_CLEANUP_ENABLED',
  'MCP_STAGING_REFERENCE_STORAGE_PREFIX',
  'CRON_SECRET',
] as const;

const PROVIDER_SECRET_FIXTURE = 'provider-secret-must-never-appear';

function runGit(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

function createDeployFixture(): string {
  const fixture = mkdtempSync(join(tmpdir(), 'mcp-staging-deploy-test-'));
  mkdirSync(join(fixture, 'frontend'), { recursive: true });
  mkdirSync(join(fixture, 'packages/pricing'), { recursive: true });
  mkdirSync(join(fixture, 'scripts'), { recursive: true });
  mkdirSync(join(fixture, 'bin'), { recursive: true });
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
  const fakeNpx = join(fixture, 'bin/npx');
  writeFileSync(fakeNpx, `#!/usr/bin/env bash
set -euo pipefail
if [[ " $* " != *" --scope camgraphes-projects "* ]]; then
  printf 'SCOPE_BLOCKED\\n' >&2
  exit 68
fi
if [[ "$*" == *'/v9/projects/maxvideoai-mcp-staging/domains'* ]]; then
  printf '%s\\n' "\${STUB_STAGING_DOMAINS_JSON}"
elif [[ "$*" == *'/v9/projects/maxvideoai-mcp-staging'* ]] && [[ "$*" != *'/env?'* ]]; then
  printf '{"id":"project-staging","name":"%s"}\\n' "\${STUB_PROJECT_NAME:-maxvideoai-mcp-staging}"
elif [[ "$*" == *'/v10/projects/maxvideoai-mcp-staging/env?'* ]]; then
  printf '%s\\n' "\${STUB_ENV_JSON}"
elif [[ "$*" == *'/v9/projects/maxvideoai/domains'* ]]; then
  printf '{"domains":[]}\\n'
elif [[ "$*" == *'/v9/projects/maxvideoai'* ]]; then
  printf '{"id":"project-production","name":"maxvideoai"}\\n'
elif [[ "$*" == *'project protection maxvideoai'* ]]; then
  printf '{}\\n'
elif [[ "$*" == *' link '* ]]; then
  if [[ " $* " == *" --project maxvideoai "* ]]; then
    printf 'EXTERNAL_PRODUCTION_MUTATION_SENTINEL\\n' >&2
    exit 70
  fi
  printf 'SAFE_LINK_SENTINEL\\n' >&2
  exit 79
else
  printf 'UNEXPECTED_VERCEL_CALL %s\\n' "$*" >&2
  exit 78
fi
`);
  chmodSync(fakeNpx, 0o755);
  runGit(fixture, ['init', '--quiet']);
  runGit(fixture, ['config', 'user.email', 'test@example.invalid']);
  runGit(fixture, ['config', 'user.name', 'MCP deploy test']);
  runGit(fixture, ['add', '.']);
  runGit(fixture, ['commit', '--quiet', '-m', 'fixture']);
  return fixture;
}

function operationalEnvironmentPayload(overrides: Partial<Record<typeof REQUIRED_OPERATIONAL_ENVIRONMENT[number], {
  key?: string;
  target?: string[];
}>> = {}): string {
  return JSON.stringify({
    envs: REQUIRED_OPERATIONAL_ENVIRONMENT.map((name) => ({
      key: overrides[name]?.key ?? name,
      target: overrides[name]?.target ?? ['production'],
      value: name === 'BYTEPLUS_ARK_API_KEY' ? PROVIDER_SECRET_FIXTURE : `non-secret-${name}`,
    })),
  });
}

function runStubbedDeploy(fixture: string, options: {
  envPayload?: string;
  projectName?: string;
  domains?: string[];
} = {}) {
  return spawnSync('bash', [join(fixture, 'scripts/deploy-mcp-staging-vercel.sh')], {
    cwd: fixture,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${join(fixture, 'bin')}:${process.env.PATH ?? ''}`,
      STUB_ENV_JSON: options.envPayload ?? operationalEnvironmentPayload(),
      STUB_PROJECT_NAME: options.projectName ?? 'maxvideoai-mcp-staging',
      STUB_STAGING_DOMAINS_JSON: JSON.stringify({
        domains: (options.domains ?? ['maxvideoai-mcp-staging.vercel.app']).map((name) => ({ name })),
      }),
    },
  });
}

function createCleanupFixture(): string {
  const fixture = mkdtempSync(join(tmpdir(), 'mcp-staging-cleanup-test-'));
  mkdirSync(join(fixture, 'scripts'), { recursive: true });
  mkdirSync(join(fixture, 'bin'), { recursive: true });
  copyFileSync(
    join(process.cwd(), 'scripts/run-mcp-staging-reference-cleanup.sh'),
    join(fixture, 'scripts/run-mcp-staging-reference-cleanup.sh'),
  );
  const fakeCurl = join(fixture, 'bin/curl');
  writeFileSync(fakeCurl, `#!/usr/bin/env bash
set -euo pipefail
output=''
previous=''
for argument in "$@"; do
  if [[ "$previous" == '--output' ]]; then output="$argument"; fi
  previous="$argument"
done
if [[ "$*" == *'mode=ledger'* ]]; then
  counter_file="\${STUB_COUNTER_ROOT}/ledger"
  count=0
  [[ -f "$counter_file" ]] && count="$(<"$counter_file")"
  printf '%s' "$((count + 1))" >"$counter_file"
  if [[ "$count" == '0' ]]; then body='{"ok":true,"mode":"ledger","selected":1,"deleted":1}';
  else body='{"ok":true,"mode":"ledger","selected":0,"deleted":0}'; fi
elif [[ "$*" == *'mode=purge-staging'* ]]; then
  counter_file="\${STUB_COUNTER_ROOT}/purge"
  count=0
  [[ -f "$counter_file" ]] && count="$(<"$counter_file")"
  printf '%s' "$((count + 1))" >"$counter_file"
  if [[ "$count" == '0' ]]; then body='{"ok":true,"mode":"purge-staging","selected":2,"deleted":2}';
  else body='{"ok":true,"mode":"purge-staging","selected":0,"deleted":0}'; fi
else
  exit 77
fi
printf '%s' "$body" >"$output"
printf '200'
`);
  chmodSync(fakeCurl, 0o755);
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

test('non-dry deployment preflight behavior fails closed before every Vercel mutation', () => {
  const fixture = createDeployFixture();
  try {
    const complete = runStubbedDeploy(fixture);
    assert.equal(complete.status, 79);
    assert.match(complete.stderr, /SAFE_LINK_SENTINEL/);
    assert.doesNotMatch(`${complete.stdout}${complete.stderr}`, new RegExp(PROVIDER_SECRET_FIXTURE));

    const validPayload = JSON.parse(operationalEnvironmentPayload()) as {
      envs: Array<{ key: string; target: string[]; value: string }>;
    };
    const missingKeyPayload = JSON.stringify({
      envs: validPayload.envs.filter((entry) => entry.key !== 'BYTEPLUS_ARK_API_KEY'),
    });
    for (const envPayload of [
      missingKeyPayload,
      operationalEnvironmentPayload({ BYTEPLUS_ARK_API_KEY: { key: 'BYTEPLUS_ARK_API_KEY_RENAMED' } }),
      operationalEnvironmentPayload({ BYTEPLUS_ARK_API_KEY: { target: ['preview'] } }),
    ]) {
      const blocked = runStubbedDeploy(fixture, { envPayload });
      assert.equal(blocked.status, 66, blocked.stderr);
      assert.equal(blocked.stderr, 'CREDENTIAL_BLOCKED\n');
      assert.doesNotMatch(`${blocked.stdout}${blocked.stderr}`, new RegExp(PROVIDER_SECRET_FIXTURE));
      assert.doesNotMatch(blocked.stderr, /SAFE_LINK_SENTINEL/);
    }

    const wrongProject = runStubbedDeploy(fixture, { projectName: 'maxvideoai' });
    assert.notEqual(wrongProject.status, 79);
    assert.doesNotMatch(wrongProject.stderr, /SAFE_LINK_SENTINEL/);

    const wrongHost = runStubbedDeploy(fixture, { domains: ['other.vercel.app'] });
    assert.notEqual(wrongHost.status, 79);
    assert.doesNotMatch(wrongHost.stderr, /SAFE_LINK_SENTINEL/);

    const fixtureScript = join(fixture, 'scripts/deploy-mcp-staging-vercel.sh');
    const original = readFileSync(fixtureScript, 'utf8');
    writeFileSync(fixtureScript, original.replace(
      "STAGING_SCOPE='camgraphes-projects'",
      "STAGING_SCOPE='wrong-scope'",
    ));
    runGit(fixture, ['add', 'scripts/deploy-mcp-staging-vercel.sh']);
    runGit(fixture, ['commit', '--quiet', '-m', 'mutate scope']);
    const wrongScope = runStubbedDeploy(fixture);
    assert.equal(wrongScope.status, 68);
    assert.match(wrongScope.stderr, /SCOPE_BLOCKED/);

    writeFileSync(fixtureScript, original.replace(
      '--project "$STAGING_PROJECT"',
      '--project "$PRODUCTION_PROJECT"',
    ));
    runGit(fixture, ['add', 'scripts/deploy-mcp-staging-vercel.sh']);
    runGit(fixture, ['commit', '--quiet', '-m', 'mutate project']);
    const productionMutation = runStubbedDeploy(fixture);
    assert.equal(productionMutation.status, 67);
    assert.equal(productionMutation.stderr, 'PRODUCTION_MUTATION_BLOCKED\n');
    assert.doesNotMatch(productionMutation.stderr, /EXTERNAL_PRODUCTION_MUTATION_SENTINEL/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('one-shot reference cleanup is local by default and teardown records bounded counts only', () => {
  const fixture = createCleanupFixture();
  const script = join(fixture, 'scripts/run-mcp-staging-reference-cleanup.sh');
  try {
    const dryRun = spawnSync('bash', [script], { cwd: fixture, encoding: 'utf8' });
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.equal(
      dryRun.stdout,
      'SAFE_CLEANUP_PLAN project=maxvideoai-mcp-staging host=maxvideoai-mcp-staging.vercel.app mode=cleanup limit=100 max_batches=20\n',
    );
    assert.equal(dryRun.stderr, '');

    const missingSecret = spawnSync('bash', [script, '--execute'], {
      cwd: fixture,
      encoding: 'utf8',
      env: { ...process.env, MCP_STAGING_CLEANUP_SECRET: '' },
    });
    assert.equal(missingSecret.status, 66);
    assert.equal(missingSecret.stderr, 'CLEANUP_CREDENTIAL_BLOCKED\n');

    const malformedSecret = spawnSync('bash', [script, '--execute'], {
      cwd: fixture,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${join(fixture, 'bin')}:${process.env.PATH ?? ''}`,
        MCP_STAGING_CLEANUP_SECRET: 'invalid\nheader = "Injected: value"',
        STUB_COUNTER_ROOT: fixture,
      },
    });
    assert.equal(malformedSecret.status, 66);
    assert.equal(malformedSecret.stderr, 'CLEANUP_CREDENTIAL_BLOCKED\n');

    const secret = 'cleanup-secret-must-never-appear';
    const executed = spawnSync('bash', [script, '--execute', '--teardown'], {
      cwd: fixture,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${join(fixture, 'bin')}:${process.env.PATH ?? ''}`,
        MCP_STAGING_CLEANUP_SECRET: secret,
        STUB_COUNTER_ROOT: fixture,
      },
    });
    assert.equal(executed.status, 0, executed.stderr);
    assert.equal(executed.stderr, '');
    assert.match(executed.stdout, /CLEANUP_BATCH_OK batch=1 selected=1 deleted=1/);
    assert.match(executed.stdout, /CLEANUP_BATCH_OK batch=2 selected=0 deleted=0/);
    assert.match(executed.stdout, /PURGE_BATCH_OK batch=1 selected=2 deleted=2/);
    assert.match(executed.stdout, /PURGE_BATCH_OK batch=2 selected=0 deleted=0/);
    assert.doesNotMatch(`${executed.stdout}${executed.stderr}`, new RegExp(secret));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
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
    script.indexOf('\nassert_staging_operational_environment\n')
      < script.indexOf('run_staging_mutation deploy'),
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
    script.indexOf('assert_protocol_endpoints "$CANDIDATE_URL"')
      < script.indexOf('run_staging_mutation promote'),
    'the candidate MCP protocol headers must be verified before promotion',
  );
  assert.doesNotMatch(script, /"\$\{VERCEL\[@\]\}" (?:link|deploy|promote)/);
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
