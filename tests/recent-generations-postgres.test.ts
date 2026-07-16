import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import pg from 'pg';

import {
  listRecentGenerations,
  type RecentGenerationRecord,
} from '../frontend/src/server/generations/recent-generations.ts';

const { Client } = pg;
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function stopPostgres(server: ChildProcessWithoutNullStreams): Promise<void> {
  if (server.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => server.once('exit', () => resolve()));
  server.kill('SIGTERM');
  await Promise.race([exited, delay(5_000)]);
  if (server.exitCode === null) server.kill('SIGKILL');
}

test('agent surface SQL matches JavaScript trim semantics on real PostgreSQL JSONB', { timeout: 30_000 }, async (t) => {
  const initProbe = spawnSync('initdb', ['--version'], { encoding: 'utf8' });
  const postgresProbe = spawnSync('postgres', ['--version'], { encoding: 'utf8' });
  const readyProbe = spawnSync('pg_isready', ['--version'], { encoding: 'utf8' });
  if (initProbe.error || postgresProbe.error || readyProbe.error) {
    t.skip('local PostgreSQL binaries are unavailable');
    return;
  }

  const root = mkdtempSync(join(tmpdir(), 'maxvideoai-agent-query-'));
  const dataDirectory = join(root, 'data');
  const socketDirectory = join(root, 'socket');
  const port = 55432;
  mkdirSync(socketDirectory);
  const initialized = spawnSync(
    'initdb',
    ['-D', dataDirectory, '--auth=trust', '--no-locale', '--encoding=UTF8'],
    { encoding: 'utf8' }
  );
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);

  const server = spawn(
    'postgres',
    ['-D', dataDirectory, '-k', socketDirectory, '-p', String(port), '-c', 'listen_addresses='],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let serverLog = '';
  server.stdout.on('data', (chunk) => { serverLog += String(chunk); });
  server.stderr.on('data', (chunk) => { serverLog += String(chunk); });

  const client = new Client({
    database: 'postgres',
    host: socketDirectory,
    port,
    user: userInfo().username,
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const probe = spawnSync('pg_isready', ['-h', socketDirectory, '-p', String(port)], {
        stdio: 'ignore',
      });
      if (probe.status === 0) {
        ready = true;
        break;
      }
      await delay(50);
    }
    assert.equal(ready, true, serverLog || 'PostgreSQL did not become ready');
    await client.connect();
    await client.query(`CREATE TABLE app_jobs (
      id integer PRIMARY KEY,
      job_id text NOT NULL,
      user_id text,
      updated_at timestamptz,
      surface text,
      billing_product_key text,
      settings_snapshot jsonb,
      engine_id text,
      engine_label text,
      duration_sec integer,
      prompt text,
      thumb_url text,
      video_url text,
      preview_video_url text,
      audio_url text,
      created_at timestamptz,
      aspect_ratio text,
      has_audio boolean,
      can_upscale boolean,
      preview_frame text,
      final_price_cents integer,
      pricing_snapshot jsonb,
      currency text,
      vendor_account_id text,
      payment_status text,
      stripe_payment_intent_id text,
      stripe_charge_id text,
      batch_id text,
      group_id text,
      iteration_index integer,
      iteration_count integer,
      render_ids jsonb,
      hero_render_id text,
      local_key text,
      message text,
      eta_seconds integer,
      eta_label text,
      visibility text,
      indexable boolean,
      status text,
      progress integer,
      provider text,
      provider_job_id text,
      hidden boolean
    )`);

    const ecmaWhitespace = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';
    const fixtures: Array<{ jobId: string; renderIds: unknown; expected: 'image' | 'video' }> = [
      { jobId: 'null', renderIds: null, expected: 'video' },
      { jobId: 'empty-array', renderIds: [], expected: 'video' },
      { jobId: 'object', renderIds: {}, expected: 'video' },
      { jobId: 'scalar', renderIds: 7, expected: 'video' },
      { jobId: 'space-string', renderIds: [' '], expected: 'video' },
      { jobId: 'tab-string', renderIds: ['\t'], expected: 'video' },
      { jobId: 'newline-string', renderIds: ['\n'], expected: 'video' },
      { jobId: 'nbsp-string', renderIds: ['\u00a0'], expected: 'video' },
      { jobId: 'ecma-string', renderIds: [ecmaWhitespace], expected: 'video' },
      { jobId: 'space-object', renderIds: [{ url: ' ' }], expected: 'video' },
      { jobId: 'tab-object', renderIds: [{ url: '\t' }], expected: 'video' },
      { jobId: 'newline-object', renderIds: [{ url: '\n' }], expected: 'video' },
      { jobId: 'nbsp-object', renderIds: [{ url: '\u00a0' }], expected: 'video' },
      { jobId: 'ecma-object', renderIds: [{ url: ecmaWhitespace }], expected: 'video' },
      { jobId: 'numeric-object-url', renderIds: [{ url: 7 }], expected: 'video' },
      { jobId: 'valid-string', renderIds: ['https://cdn.maxvideoai.com/valid.png'], expected: 'image' },
      { jobId: 'valid-object', renderIds: [{ url: 'https://cdn.maxvideoai.com/valid-object.png' }], expected: 'image' },
    ];
    for (const [index, fixture] of fixtures.entries()) {
      await client.query(
        `INSERT INTO app_jobs (
          id, job_id, user_id, updated_at, engine_id, engine_label, duration_sec, prompt,
          created_at, final_price_cents, currency, payment_status, render_ids, status,
          progress, visibility, indexable, hidden
        ) VALUES (
          $1, $2, 'user_1', NOW(), 'test-video-engine', 'Test Video', 5, '',
          NOW() - ($3 * INTERVAL '1 second'), 1, 'USD', 'paid_wallet', $4::jsonb,
          'queued', 0, 'private', false, false
        )`,
        [fixtures.length - index, fixture.jobId, index, fixture.renderIds === null ? null : JSON.stringify(fixture.renderIds)]
      );
    }

    const queryFn = async (sql: string, params?: ReadonlyArray<unknown>) =>
      (await client.query(sql, params ? [...params] : [])).rows as RecentGenerationRecord[];
    const [images, videos] = await Promise.all([
      listRecentGenerations({ userId: 'user_1', surface: 'image', limit: 50, queryFn }),
      listRecentGenerations({ userId: 'user_1', surface: 'video', limit: 50, queryFn }),
    ]);
    const expectedImages = fixtures.filter((fixture) => fixture.expected === 'image').map((fixture) => fixture.jobId).sort();
    const expectedVideos = fixtures.filter((fixture) => fixture.expected === 'video').map((fixture) => fixture.jobId).sort();

    assert.deepEqual(images.items.map((item) => item.jobId).sort(), expectedImages);
    assert.ok(images.items.every((item) => item.surface === 'image'));
    assert.deepEqual(videos.items.map((item) => item.jobId).sort(), expectedVideos);
    assert.ok(videos.items.every((item) => item.surface === 'video'));
  } finally {
    await client.end().catch(() => undefined);
    await stopPostgres(server);
    rmSync(root, { recursive: true, force: true });
  }
});
