import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';

type ValidationAction = {
  name: string;
  description: string;
  runs: {
    using: string;
    steps: Array<{ name: string; shell: string; run: string }>;
  };
};

function readAction(): ValidationAction {
  return YAML.parse(readFileSync('.github/actions/setup-validation-tools/action.yml', 'utf8'));
}

function transportPython(): string {
  const step = readAction().runs.steps[0];
  assert.equal(step?.name, 'Select official Ubuntu archive transport', 'Ubuntu transport step is missing');
  assert.equal(step.shell, 'bash');
  const match = /^sudo python3 - <<'PYTHON'\n([\s\S]+)\nPYTHON\n?$/.exec(step.run);
  assert.ok(match, 'transport step must contain the executable Python heredoc');
  return match[1];
}

function withAptRoot(check: (root: string) => void): void {
  const root = mkdtempSync(path.join(tmpdir(), 'ci-ubuntu-mirror-'));
  try {
    check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeSource(root: string, name: string, content: string): string {
  const source = path.join(root, 'etc', 'apt', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(source, content);
  return source;
}

function runTransport(root: string): string {
  // Execute the action's real Python, redirecting only its APT filesystem root.
  // The shell wrapper, sudo and installation commands are never executed.
  const script = transportPython().replaceAll('/etc/apt/', `${root}/etc/apt/`);
  const result = spawnSync('python3', ['-c', script], { encoding: 'utf8', timeout: 10_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return result.stdout;
}

test('Ubuntu deb822 transport preserves suites, components and signing keys', () => {
  withAptRoot(root => {
    const source = writeSource(root, 'sources.list.d/ubuntu.sources', [
      'Types: deb deb-src',
      'URIs: http://azure.archive.ubuntu.com/ubuntu/',
      'Suites: noble noble-updates noble-backports noble-security',
      'Components: main restricted universe multiverse',
      'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg',
      '',
    ].join('\n'));
    runTransport(root);
    assert.equal(readFileSync(source, 'utf8'), [
      'Types: deb deb-src',
      'URIs: https://archive.ubuntu.com/ubuntu/',
      'Suites: noble noble-updates noble-backports noble-security',
      'Components: main restricted universe multiverse',
      'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg',
      '',
    ].join('\n'));
  });
});

test('traditional APT sources retain options and pockets while using the official transport', () => {
  withAptRoot(root => {
    const source = writeSource(root, 'sources.list', [
      'deb [arch=amd64 signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] http://azure.archive.ubuntu.com/ubuntu noble main restricted',
      'deb-src https://azure.archive.ubuntu.com/ubuntu/ noble-updates universe',
      '',
    ].join('\n'));
    runTransport(root);
    assert.equal(readFileSync(source, 'utf8'), [
      'deb [arch=amd64 signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] https://archive.ubuntu.com/ubuntu noble main restricted',
      'deb-src https://archive.ubuntu.com/ubuntu/ noble-updates universe',
      '',
    ].join('\n'));
  });
});

test('both known mirrorlists accept HTTP and HTTPS endpoints with or without a trailing slash', () => {
  withAptRoot(root => {
    const sources = ['apt-mirrors.txt', 'security-mirrors.txt'].map(name => writeSource(root, name,
      'http://azure.archive.ubuntu.com/ubuntu\nhttps://azure.archive.ubuntu.com/ubuntu/\n'));
    runTransport(root);
    for (const source of sources) {
      assert.equal(readFileSync(source, 'utf8'),
        'https://archive.ubuntu.com/ubuntu\nhttps://archive.ubuntu.com/ubuntu/\n');
    }
  });
});

test('unrelated repositories, neighboring hosts and paths, and unlisted source files stay unchanged', () => {
  withAptRoot(root => {
    const original = [
      'deb http://security.ubuntu.com/ubuntu noble-security main',
      'deb https://apt.postgresql.org/pub/repos/apt noble-pgdg main',
      'deb https://deb.debian.org/debian bookworm main',
      'deb http://azure.archive.ubuntu.com.evil/ubuntu noble main',
      'deb http://azure.archive.ubuntu.com/ubuntu-other noble main',
      '',
    ].join('\n');
    const source = writeSource(root, 'sources.list', original);
    const unlisted = writeSource(root, 'sources.list.d/custom.list',
      'deb http://azure.archive.ubuntu.com/ubuntu noble main\n');
    assert.equal(runTransport(root), '');
    assert.equal(readFileSync(source, 'utf8'), original);
    assert.equal(readFileSync(unlisted, 'utf8'), 'deb http://azure.archive.ubuntu.com/ubuntu noble main\n');
  });
});

test('missing APT sources are safe and are not created', () => {
  withAptRoot(root => {
    assert.equal(runTransport(root), '');
    assert.deepEqual(readdirSync(root), []);
    mkdirSync(path.join(root, 'etc', 'apt', 'sources.list'), { recursive: true });
    assert.equal(runTransport(root), '');
    assert.deepEqual(readdirSync(path.join(root, 'etc', 'apt', 'sources.list')), []);
  });
});

test('repeated transport selection does not rewrite already converted sources', () => {
  withAptRoot(root => {
    const source = writeSource(root, 'security-mirrors.txt', 'http://azure.archive.ubuntu.com/ubuntu noble-security\n');
    assert.notEqual(runTransport(root), '');
    assert.equal(readFileSync(source, 'utf8'), 'https://archive.ubuntu.com/ubuntu noble-security\n');
    const modifiedAt = statSync(source, { bigint: true }).mtimeNs;
    assert.equal(runTransport(root), '');
    assert.equal(readFileSync(source, 'utf8'), 'https://archive.ubuntu.com/ubuntu noble-security\n');
    assert.equal(statSync(source, { bigint: true }).mtimeNs, modifiedAt);
  });
});

test('transport selection preserves every existing installation command and has valid shell syntax', () => {
  const action = readAction();
  transportPython();
  assert.equal(action.name, 'Setup validation tools');
  assert.equal(action.description, 'Install FFmpeg and PostgreSQL 17 for disposable integration fixtures.');
  assert.equal(action.runs.using, 'composite');
  assert.deepEqual(action.runs.steps.slice(1), [{
    name: 'Install media and database validation tools',
    shell: 'bash',
    run: [
      'sudo apt-get update',
      'sudo apt-get install --yes --no-install-recommends ffmpeg postgresql-common',
      'sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y',
      'sudo apt-get install --yes --no-install-recommends postgresql-17',
      'echo \'/usr/lib/postgresql/17/bin\' >> "$GITHUB_PATH"',
      '/usr/lib/postgresql/17/bin/postgres --version',
      'ffmpeg -hide_banner -version',
      '',
    ].join('\n'),
  }]);
  const syntax = spawnSync('bash', ['-n'], { input: action.runs.steps[0].run, encoding: 'utf8' });
  assert.ifError(syntax.error);
  assert.equal(syntax.status, 0, syntax.stderr);
});
