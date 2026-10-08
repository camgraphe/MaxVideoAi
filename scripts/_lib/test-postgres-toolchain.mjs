import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';

const commands = ['postgres', 'initdb', 'pg_ctl', 'psql', 'pg_isready'];

// Test-only discovery. Probe executable versions; never start a service or use a database URL.
export function resolveTestPostgres(environment = process.env) {
  const override = environment.TEST_POSTGRES_BIN;
  const knownDirectories = process.platform === 'darwin'
    ? ['/opt/homebrew/opt/postgresql@17/bin', '/usr/local/opt/postgresql@17/bin']
    : process.platform === 'linux' ? ['/usr/lib/postgresql/17/bin'] : [];
  const candidates = [...new Set((override
    ? [override]
    : [...(environment.PATH ?? '').split(delimiter).filter(Boolean), ...knownDirectories]
  ).map(directory => resolve(directory)))];
  const failures = [];

  for (const binDirectory of candidates) {
    const suffix = process.platform === 'win32' ? '.exe' : '';
    const executables = Object.fromEntries(commands.map(command => [command, join(binDirectory, `${command}${suffix}`)]));
    if (!override && !existsSync(executables.initdb)) continue;
    let failure;
    for (const command of commands) {
      const executable = executables[command];
      if (!existsSync(executable)) {
        failure = `${command} is missing`;
        break;
      }
      const result = spawnSync(executable, ['--version'], { encoding: 'utf8', env: environment, timeout: 5_000 });
      const version = result.stdout?.trim() ?? '';
      const major = version.match(/\bPostgreSQL\)?\s+(\d+)(?:\.|\s|$)/)?.[1];
      if (result.error || result.status !== 0 || major !== '17') {
        failure = `${command}: ${version || result.error?.message || 'version probe failed'}`;
        break;
      }
    }
    if (failure) {
      failures.push(`${binDirectory}: ${failure}`);
      continue;
    }
    return {
      binDirectory,
      commands: executables,
      env: {
        ...environment,
        TEST_POSTGRES_BIN: binDirectory,
        PATH: [binDirectory, environment.PATH].filter(Boolean).join(delimiter),
      },
    };
  }

  throw new Error([
    'PostgreSQL 17 is required for disposable database tests; no complete PostgreSQL 17 toolchain was found.',
    ...failures,
    'macOS: brew install postgresql@17. Linux: install postgresql-17.',
    'For another installation, set TEST_POSTGRES_BIN to its bin directory (all tools must be PostgreSQL 17).',
  ].join('\n'));
}

export function reportTestPostgres(toolchain) {
  process.stdout.write(`[test-tools] PostgreSQL 17: ${toolchain.binDirectory}\n`);
}
