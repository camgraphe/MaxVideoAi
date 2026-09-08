import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  missingDisposablePostgresCommand,
  startDisposablePostgres,
} from './helpers/disposable-postgres.ts';

function commandOutput(result: ReturnType<typeof spawnSync>): string {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

test('explicit schema bootstrap establishes the baseline before migrations and read-only Activity queries', { timeout: 60_000 }, async (t) => {
  const missingCommand = missingDisposablePostgresCommand();
  if (missingCommand) {
    t.skip(`${missingCommand} is unavailable`);
    return;
  }

  const postgres = await startDisposablePostgres('app-schema');
  t.after(() => postgres.cleanup());

  const bootstrap = spawnSync(
    'frontend/node_modules/.bin/tsx',
    [
      '--tsconfig',
      'frontend/tsconfig.json',
      'scripts/bootstrap-application-schema.ts',
      '--allow-local-postgres-test',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        APPLICATION_DATABASE_URL: postgres.databaseUrl,
      },
    },
  );
  assert.equal(bootstrap.status, 0, commandOutput(bootstrap));
  assert.match(bootstrap.stdout, /Application schema bootstrap completed/);
  assert.doesNotMatch(bootstrap.stdout, /postgresql:\/\//);

  const migrationFiles = readdirSync('neon/migrations')
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const migrationFile of migrationFiles) {
    const migrated = spawnSync(
      'psql',
      [postgres.databaseUrl, '--single-transaction', '-v', 'ON_ERROR_STOP=1', '-f', join('neon/migrations', migrationFile)],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    assert.equal(migrated.status, 0, `${migrationFile}: ${commandOutput(migrated)}`);
  }

  await postgres.pool.query(
    `INSERT INTO app_jobs (
       job_id, user_id, surface, engine_id, engine_label, duration_sec, prompt,
       thumb_url, video_url, preview_frame, status, progress, created_at, updated_at
     ) VALUES (
       'bootstrap-read-job', 'bootstrap-read-user', 'video', 'seedance-2-0-mini',
       'Seedance 2 Mini', 5, 'fixture', '', 'https://cdn.example/video.mp4',
       'https://cdn.example/poster.webp', 'completed', 100, NOW(), NOW()
     )`,
  );

  process.env.DATABASE_URL = postgres.databaseUrl;
  process.env.PGOPTIONS = '-c default_transaction_read_only=on';
  const [{ readRecentGenerationRecordsForWeb }, { listJobOutputsByJobIds }, { getDb }] = await Promise.all([
    import('../frontend/src/server/generations/recent-generations.ts'),
    import('../frontend/server/media-library/job-outputs.ts'),
    import('../frontend/src/lib/db.ts'),
  ]);
  const rows = await readRecentGenerationRecordsForWeb({
    userId: 'bootstrap-read-user',
    feedType: 'all',
    requestedSurface: null,
    limit: 24,
  });
  const outputs = await listJobOutputsByJobIds(['bootstrap-read-job'], { ensureSchema: false });
  assert.equal(rows[0]?.job_id, 'bootstrap-read-job');
  assert.equal(outputs.size, 0);
  await getDb().end();
  delete process.env.PGOPTIONS;
  delete process.env.DATABASE_URL;
});

test('schema bootstrap refuses inherited database URLs and unconfirmed local targets', () => {
  const baseEnv = {
    PATH: process.env.PATH,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://inherited.invalid/legacy',
  };
  const inherited = spawnSync(
    'frontend/node_modules/.bin/tsx',
    ['--tsconfig', 'frontend/tsconfig.json', 'scripts/bootstrap-application-schema.ts'],
    { cwd: process.cwd(), encoding: 'utf8', env: baseEnv },
  );
  assert.notEqual(inherited.status, 0);
  assert.match(commandOutput(inherited), /APPLICATION_DATABASE_URL is required/);

  const local = spawnSync(
    'frontend/node_modules/.bin/tsx',
    ['--tsconfig', 'frontend/tsconfig.json', 'scripts/bootstrap-application-schema.ts'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...baseEnv, APPLICATION_DATABASE_URL: 'postgresql://postgres@localhost/postgres' },
    },
  );
  assert.notEqual(local.status, 0);
  assert.match(commandOutput(local), /direct Neon target/);
});

test('schema bootstrap rejects query parameters that override the validated Neon host', () => {
  for (const overriddenHost of ['127.0.0.1', 'ep-other-pooler.neon.tech']) {
    const result = spawnSync(
      'frontend/node_modules/.bin/tsx',
      ['--tsconfig', 'frontend/tsconfig.json', 'scripts/bootstrap-application-schema.ts'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          APPLICATION_DATABASE_URL:
            `postgresql://review_user@ep-review.neon.tech/review_db?host=${overriddenHost}`,
        },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(commandOutput(result), /target override query parameters/);
    assert.doesNotMatch(commandOutput(result), /ECONNREFUSED|getaddrinfo|ENOTFOUND/);
  }
});
