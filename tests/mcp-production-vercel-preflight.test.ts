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

const REQUIRED_PRODUCTION_ENVIRONMENT = [
  'MCP_API_HOST',
  'MCP_RESOURCE_URL',
  'MCP_ACQUISITION_SIGNING_SECRET',
  'MCP_TOPUP_HANDOFF_SECRET',
  'DATABASE_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SITE_URL',
  'S3_BUCKET',
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_PUBLIC_BASE_URL',
  'VIDEO_RENDER_STORAGE_PREFIX',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'CRON_SECRET',
  'FAL_WEBHOOK_TOKEN',
  'FAL_POLL_TOKEN',
] as const;

const SECRET_SENTINEL = 'secret-value-must-never-appear';

function createFixture(): string {
  const scriptPath = join(process.cwd(), 'scripts/preflight-mcp-production-vercel.sh');
  assert.equal(existsSync(scriptPath), true, 'production Vercel preflight script must exist');
  const fixture = mkdtempSync(join(tmpdir(), 'mcp-production-preflight-test-'));
  mkdirSync(join(fixture, 'scripts'), { recursive: true });
  mkdirSync(join(fixture, 'frontend/config'), { recursive: true });
  mkdirSync(join(fixture, 'bin'), { recursive: true });
  copyFileSync(
    scriptPath,
    join(fixture, 'scripts/preflight-mcp-production-vercel.sh'),
  );
  copyFileSync(
    join(process.cwd(), 'frontend/config/mcp-publication.json'),
    join(fixture, 'frontend/config/mcp-publication.json'),
  );
  copyFileSync(join(process.cwd(), 'package.json'), join(fixture, 'package.json'));
  copyFileSync(join(process.cwd(), 'frontend/package.json'), join(fixture, 'frontend/package.json'));
  copyFileSync(join(process.cwd(), 'frontend/vercel.json'), join(fixture, 'frontend/vercel.json'));

  const fakeNpx = join(fixture, 'bin/npx');
  writeFileSync(fakeNpx, `#!/usr/bin/env bash
set -euo pipefail
case " $* " in
  *" deploy "*|*" link "*|*" promote "*|*" alias "*|*" env add "*|*" env rm "*)
    printf 'MUTATION_ATTEMPTED\\n' >&2
    exit 90
    ;;
esac
if [[ " $* " != *" --scope camgraphes-projects "* ]]; then
  printf 'WRONG_SCOPE\\n' >&2
  exit 91
fi
if [[ "$*" == *'/v9/projects/maxvideoai'* ]] && [[ "$*" != *'/env?'* ]]; then
  printf '%s\\n' "\${STUB_PROJECT_JSON}"
elif [[ "$*" == *'/v10/projects/maxvideoai/env?decrypt=false&target=production'* ]]; then
  printf '%s\\n' "\${STUB_ENV_JSON}"
else
  printf 'UNEXPECTED_VERCEL_CALL %s\\n' "$*" >&2
  exit 92
fi
`);
  chmodSync(fakeNpx, 0o755);

  for (const args of [
    ['init', '-q'],
    ['add', '.'],
    ['-c', 'user.email=mcp-preflight@example.invalid', '-c', 'user.name=MCP Preflight', 'commit', '-qm', 'fixture'],
  ]) {
    const result = spawnSync('git', args, { cwd: fixture, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  return fixture;
}

function commitFixture(fixture: string, message: string): void {
  for (const args of [
    ['add', '.'],
    ['-c', 'user.email=mcp-preflight@example.invalid', '-c', 'user.name=MCP Preflight', 'commit', '-qm', message],
  ]) {
    const result = spawnSync('git', args, { cwd: fixture, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
}

function environmentPayload(options: {
  falName?: 'FAL_API_KEY' | 'FAL_KEY' | null;
  omit?: string | string[];
  wrongTarget?: string;
} = {}): string {
  const falName = options.falName === undefined ? 'FAL_KEY' : options.falName;
  const omitted = new Set(Array.isArray(options.omit) ? options.omit : options.omit ? [options.omit] : []);
  const names = [
    ...REQUIRED_PRODUCTION_ENVIRONMENT,
    ...(falName ? [falName] : []),
  ].filter((name) => !omitted.has(name));

  return JSON.stringify({
    envs: names.map((key) => ({
      key,
      target: key === options.wrongTarget ? ['preview'] : ['production'],
      value: SECRET_SENTINEL,
    })),
  });
}

function runPreflight(fixture: string, options: {
  envPayload?: string;
  projectPayload?: string;
} = {}) {
  return spawnSync('bash', [join(fixture, 'scripts/preflight-mcp-production-vercel.sh')], {
    cwd: fixture,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${join(fixture, 'bin')}:${process.env.PATH ?? ''}`,
      STUB_PROJECT_JSON: options.projectPayload
        ?? JSON.stringify({ name: 'maxvideoai', rootDirectory: 'frontend', secret: SECRET_SENTINEL }),
      STUB_ENV_JSON: options.envPayload ?? environmentPayload(),
    },
  });
}

test('production Vercel preflight checks metadata without leaking environment values', () => {
  const fixture = createFixture();
  try {
    const result = runPreflight(fixture);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PRODUCTION_VERCEL_PREFLIGHT_OK/);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(SECRET_SENTINEL));
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /MUTATION_ATTEMPTED/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('production Vercel preflight accepts FAL_API_KEY as the FAL credential alias', () => {
  const fixture = createFixture();
  try {
    const result = runPreflight(fixture, {
      envPayload: environmentPayload({ falName: 'FAL_API_KEY' }),
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /fal=FAL_API_KEY/);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(SECRET_SENTINEL));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('production Vercel preflight fails closed for a missing or mistargeted required variable', () => {
  const fixture = createFixture();
  try {
    for (const envPayload of [
      environmentPayload({ omit: 'MCP_ACQUISITION_SIGNING_SECRET' }),
      environmentPayload({ wrongTarget: 'MCP_RESOURCE_URL' }),
    ]) {
      const result = runPreflight(fixture, { envPayload });
      assert.equal(result.status, 66, result.stderr);
      assert.match(result.stderr, /ENVIRONMENT_BLOCKED name=MCP_(?:ACQUISITION_SIGNING_SECRET|RESOURCE_URL) target=production/);
      assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(SECRET_SENTINEL));
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('production Vercel preflight reports every missing required name in one safe pass', () => {
  const fixture = createFixture();
  try {
    const result = runPreflight(fixture, {
      envPayload: environmentPayload({
        omit: ['MCP_ACQUISITION_SIGNING_SECRET', 'VIDEO_RENDER_STORAGE_PREFIX'],
      }),
    });
    assert.equal(result.status, 66, result.stderr);
    assert.match(result.stderr, /ENVIRONMENT_BLOCKED name=MCP_ACQUISITION_SIGNING_SECRET target=production/);
    assert.match(result.stderr, /ENVIRONMENT_BLOCKED name=VIDEO_RENDER_STORAGE_PREFIX target=production/);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(SECRET_SENTINEL));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('production Vercel preflight fails closed when neither FAL credential alias targets production', () => {
  const fixture = createFixture();
  try {
    const result = runPreflight(fixture, {
      envPayload: environmentPayload({ falName: null }),
    });
    assert.equal(result.status, 66, result.stderr);
    assert.equal(result.stderr, 'ENVIRONMENT_BLOCKED one_of=FAL_API_KEY,FAL_KEY target=production\n');
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(SECRET_SENTINEL));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('production Vercel preflight requires the first candidate to keep all eight flags false', () => {
  const fixture = createFixture();
  try {
    const publicationPath = join(fixture, 'frontend/config/mcp-publication.json');
    const publication = JSON.parse(readFileSync(publicationPath, 'utf8')) as Record<string, boolean>;
    publication.transport = true;
    writeFileSync(publicationPath, `${JSON.stringify(publication, null, 2)}\n`);

    const result = runPreflight(fixture);
    assert.equal(result.status, 67, result.stderr);
    assert.equal(result.stderr, 'PUBLICATION_BLOCKED expected=all-eight-false\n');
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(SECRET_SENTINEL));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('production Vercel preflight refuses MCP schedules while the dark-candidate flags are false', () => {
  const fixture = createFixture();
  try {
    const vercelPath = join(fixture, 'frontend/vercel.json');
    const vercel = JSON.parse(readFileSync(vercelPath, 'utf8')) as {
      crons?: Array<{ path: string; schedule: string }>;
    };
    vercel.crons ??= [];
    vercel.crons.push({
      path: '/api/cron/mcp-trial-reconcile',
      schedule: '*/10 * * * *',
    });
    writeFileSync(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`);
    commitFixture(fixture, 'add unsafe dark-candidate cron');

    const result = runPreflight(fixture);
    assert.equal(result.status, 70, result.stderr);
    assert.equal(result.stderr, 'CRON_INVENTORY_BLOCKED expected=no-mcp-crons-while-all-eight-false\n');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('production Vercel preflight refuses a floating major Node runtime', () => {
  const fixture = createFixture();
  try {
    const packagePath = join(fixture, 'package.json');
    const manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as {
      engines?: { node?: string };
    };
    manifest.engines = { ...manifest.engines, node: '>=22' };
    writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
    commitFixture(fixture, 'float unsafe production node runtime');

    const result = runPreflight(fixture);
    assert.equal(result.status, 71, result.stderr);
    assert.equal(result.stderr, 'NODE_RUNTIME_BLOCKED expected=22.x package=package.json\n');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('production Vercel preflight refuses an uncommitted candidate source tree', () => {
  const fixture = createFixture();
  try {
    writeFileSync(join(fixture, 'uncommitted.txt'), 'not reviewed\n');

    const result = runPreflight(fixture);
    assert.equal(result.status, 69, result.stderr);
    assert.equal(result.stderr, 'WORKTREE_BLOCKED expected=clean-tracked-head\n');
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(SECRET_SENTINEL));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
