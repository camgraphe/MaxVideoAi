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
  const match = /\nsudo python3 - "\$ubuntu_archive_url" <<'PYTHON'\n([\s\S]+)\nPYTHON\n?$/.exec(step.run);
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

function runTransport(root: string, archive = 'https://archive.ubuntu.com/ubuntu'): string {
  // Execute the action's real Python, redirecting only its APT filesystem root.
  // The shell wrapper, sudo and installation commands are never executed.
  const script = transportPython().replaceAll('/etc/apt/', `${root}/etc/apt/`);
  const result = spawnSync('python3', ['-c', script, archive], { encoding: 'utf8', timeout: 10_000 });
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

test('a reachable Azure archive replaces an unreachable canonical archive without changing trust', () => {
  withAptRoot(root => {
    const source = writeSource(root, 'sources.list.d/ubuntu.sources', [
      'Types: deb',
      'URIs: https://archive.ubuntu.com/ubuntu/',
      'Suites: noble noble-updates noble-backports noble-security',
      'Components: main universe',
      'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg',
      '',
    ].join('\n'));
    const original = readFileSync(source, 'utf8');
    runTransport(root, 'https://azure.archive.ubuntu.com/ubuntu');
    assert.equal(readFileSync(source, 'utf8'), original.replace(
      'https://archive.ubuntu.com/ubuntu/', 'https://azure.archive.ubuntu.com/ubuntu/'));
  });
});

for (const reachable of ['canonical', 'azure', 'neither'] as const) {
  test(`archive probe handles ${reachable} availability before modifying sources`, () => {
    withAptRoot(root => {
      const calls = path.join(root, 'calls');
      const bin = path.join(root, 'bin');
      mkdirSync(bin);
      writeFileSync(path.join(bin, 'curl'), [
        '#!/bin/bash',
        'printf "%s\\n" "$*" >> "$PROBE_CALLS"',
        'case "$*" in',
        '  *https://azure.archive.ubuntu.com/*) [ "$REACHABLE_ARCHIVE" = azure ] ;;',
        '  *https://archive.ubuntu.com/*) [ "$REACHABLE_ARCHIVE" = canonical ] ;;',
        '  *) exit 2 ;;',
        'esac',
      ].join('\n'), { mode: 0o755 });
      // Run the real selection shell only, replacing the privileged write with a marker.
      const probe = readAction().runs.steps[0].run.split('sudo python3')[0]
        .replace('. /etc/os-release', 'VERSION_CODENAME=noble');
      const result = spawnSync('bash', ['-e', '-c', `${probe}\nprintf 'SELECTED=%s\\n' "$ubuntu_archive_url"`], {
        encoding: 'utf8', timeout: 10_000,
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PROBE_CALLS: calls, REACHABLE_ARCHIVE: reachable },
      });
      assert.ifError(result.error);
      assert.equal(result.status, reachable === 'neither' ? 1 : 0, result.stderr);
      const probes = readFileSync(calls, 'utf8').trim().split('\n');
      assert.equal(probes.length, reachable === 'canonical' ? 1 : 2);
      for (const call of probes) {
        assert.match(call, /--fail --silent --show-error --connect-timeout 5 --max-time 15/);
        assert.match(call, /\/dists\/noble\/InRelease --output \/dev\/null/);
      }
      if (reachable === 'neither') {
        assert.match(result.stderr, /No official Ubuntu archive is reachable/);
        assert.doesNotMatch(result.stdout, /SELECTED=/);
      } else {
        assert.match(result.stdout, new RegExp(`SELECTED=https://${reachable === 'azure' ? 'azure\\.' : ''}archive\\.ubuntu\\.com/ubuntu`));
      }
    });
  });
}

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

test('transport selection preserves required installations and rejects incomplete index refreshes', () => {
  const action = readAction();
  transportPython();
  assert.equal(action.name, 'Setup validation tools');
  assert.equal(action.description, 'Install FFmpeg and PostgreSQL 17 for disposable integration fixtures.');
  assert.equal(action.runs.using, 'composite');
  assert.deepEqual(action.runs.steps.slice(1), [{
    name: 'Install media and database validation tools',
    shell: 'bash',
    run: [
      'sudo timeout 5m apt-get update --error-on=any',
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
