import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import test from 'node:test';

const toolchainPath = resolve('scripts/_lib/test-postgres-toolchain.mjs');
const commands = ['postgres', 'initdb', 'pg_ctl', 'psql', 'pg_isready'];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'test-pg-tools-'));
  const writes = join(root, 'database-writes');
  return {
    root,
    writes,
    bin(name: string, major: number, overrides: Record<string, number> = {}) {
      const directory = join(root, name);
      mkdirSync(directory);
      for (const command of commands) {
        writeFileSync(join(directory, command), `#!${process.execPath}
if (process.argv[2] !== '--version') {
  require('node:fs').appendFileSync(${JSON.stringify(writes)}, process.argv.join(' ') + '\\n');
  process.exit(99);
}
process.stdout.write(${JSON.stringify(`${command} (PostgreSQL) ${overrides[command] ?? major}.6\n`)});
`, { mode: 0o755 });
      }
      return directory;
    },
    cleanup() { rmSync(root, { recursive: true, force: true }); },
  };
}

test('test PostgreSQL selects one complete PG17 installation even when PG14 leads PATH', async () => {
  const tools = fixture();
  try {
    const pg14 = tools.bin('postgres-14', 14);
    const pg17 = tools.bin('postgres 17', 17);
    const environment = { PATH: [pg14, pg17].join(delimiter), DATABASE_URL: 'must-not-be-used' };
    const previousPath = process.env.PATH;
    const { resolveTestPostgres } = await import(toolchainPath);
    const selected = resolveTestPostgres(environment);
    assert.equal(selected.binDirectory, pg17);
    assert.equal(selected.env.PATH.split(delimiter)[0], pg17);
    assert.equal(selected.env.TEST_POSTGRES_BIN, pg17);
    assert.equal(selected.env.DATABASE_URL, 'must-not-be-used');
    assert.equal(environment.PATH, [pg14, pg17].join(delimiter));
    assert.equal(process.env.PATH, previousPath, 'selection must not alter the host environment');
    for (const command of commands) assert.equal(selected.commands[command], join(pg17, command));
    assert.equal(existsSync(tools.writes), false, 'selection only probes versions');
  } finally { tools.cleanup(); }
});

test('an explicit test PostgreSQL directory rejects mixed major versions before creating a database', async () => {
  const tools = fixture();
  try {
    const mixed = tools.bin('mixed', 17, { pg_ctl: 14 });
    const { resolveTestPostgres } = await import(toolchainPath);
    assert.throws(() => resolveTestPostgres({ TEST_POSTGRES_BIN: mixed, PATH: '' }),
      (error: Error) => /PostgreSQL 17/.test(error.message) && /pg_ctl.*14/.test(error.message));
    assert.equal(existsSync(tools.writes), false);
  } finally { tools.cleanup(); }
});

test('explicit PostgreSQL overrides are strict and report how to install the missing version', async () => {
  const tools = fixture();
  try {
    const pg14 = tools.bin('postgres-14', 14);
    const pg17 = tools.bin('postgres-17', 17);
    const { resolveTestPostgres } = await import(toolchainPath);
    assert.throws(() => resolveTestPostgres({ TEST_POSTGRES_BIN: pg14, PATH: pg17 }),
      /PostgreSQL 17[\s\S]*TEST_POSTGRES_BIN/);
    assert.throws(() => resolveTestPostgres({ TEST_POSTGRES_BIN: join(tools.root, 'missing'), PATH: pg17 }),
      /PostgreSQL 17[\s\S]*brew install postgresql@17/);
    assert.equal(existsSync(tools.writes), false);
  } finally { tools.cleanup(); }
});

test('PostgreSQL selection refuses partial tool installations', async () => {
  const tools = fixture();
  try {
    const partial = tools.bin('partial', 17);
    rmSync(join(partial, 'psql'));
    const { resolveTestPostgres } = await import(toolchainPath);
    assert.throws(() => resolveTestPostgres({ TEST_POSTGRES_BIN: partial, PATH: '' }), /PostgreSQL 17[\s\S]*psql/);
  } finally { tools.cleanup(); }
});

test('validation plans and fast checks stay independent of PostgreSQL installation', () => {
  const environment = { ...process.env, TEST_POSTGRES_BIN: '/missing-test-postgresql' };
  const plan = spawnSync(process.execPath, ['scripts/run-validation-tests.mjs', '--plan'], { encoding: 'utf8', env: environment });
  assert.equal(plan.status, 0, plan.stderr);
  assert.ok(JSON.parse(plan.stdout).fast.includes('tests/test-postgres-toolchain.test.ts'));

  const tools = fixture();
  try {
    const proof = join(tools.root, 'fast-args.json');
    writeFileSync(join(tools.root, 'pnpm'), `#!${process.execPath}
require('node:fs').writeFileSync(${JSON.stringify(proof)}, JSON.stringify(process.argv.slice(2)));
`, { mode: 0o755 });
    const fast = spawnSync(process.execPath, ['scripts/run-validation-tests.mjs', '--suite', 'fast'], {
      encoding: 'utf8', env: { ...environment, PATH: tools.root },
    });
    assert.equal(fast.status, 0, fast.stderr);
    assert.ok(JSON.parse(readFileSync(proof, 'utf8')).includes('tests/test-postgres-toolchain.test.ts'));
    assert.doesNotMatch(fast.stdout, /\[test-tools\]/);
  } finally { tools.cleanup(); }
});

test('database validation fails before launching the suite when the PG17 toolchain is unavailable', () => {
  const result = spawnSync(process.execPath, ['scripts/run-validation-tests.mjs', '--suite', 'integration'], {
    encoding: 'utf8', timeout: 5_000,
    env: { ...process.env, TEST_POSTGRES_BIN: '/missing-test-postgresql' },
  });
  assert.equal(result.error, undefined, 'preflight must fail promptly');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /PostgreSQL 17/);
  assert.doesNotMatch(result.stdout, /\[validate\].*suite/);
});

test('the PostgreSQL test launcher preserves arguments, child status and the selected environment', () => {
  const tools = fixture();
  try {
    const pg17 = tools.bin('postgres 17', 17);
    const proof = join(tools.root, 'child.json');
    const child = join(tools.root, 'child.mjs');
    writeFileSync(child, `import {writeFileSync} from 'node:fs';
writeFileSync(${JSON.stringify(proof)}, JSON.stringify({args:process.argv.slice(2),bin:process.env.TEST_POSTGRES_BIN,path:process.env.PATH}));
process.exit(7);
`);
    const result = spawnSync(process.execPath, ['scripts/run-postgres-tests.mjs', process.execPath, child, 'two words', '--test-name-pattern=a b'], {
      encoding: 'utf8', env: { ...process.env, TEST_POSTGRES_BIN: pg17 },
    });
    assert.equal(result.status, 7, result.stderr);
    const observed = JSON.parse(readFileSync(proof, 'utf8'));
    assert.deepEqual(observed.args, ['two words', '--test-name-pattern=a b']);
    assert.equal(observed.bin, pg17);
    assert.equal(observed.path.split(delimiter)[0], pg17);
    assert.equal(existsSync(tools.writes), false);
  } finally { tools.cleanup(); }
});
