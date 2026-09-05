import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getImageThumbnailBackfillExitCode,
  parseImageThumbnailBackfillOptions,
  runImageThumbnailBackfill,
  type BackfillRow,
} from '../frontend/scripts/_lib/image-thumbnail-backfill';

type QueryCall = { sql: string; params: ReadonlyArray<unknown> };

function row(overrides: Partial<BackfillRow> = {}): BackfillRow {
  return {
    id: 1,
    job_id: 'job-1',
    user_id: 'user-1',
    thumb_url: null,
    render_ids: [{ url: 'https://media.example/original-1.png', thumb_url: 'https://media.example/thumb-1.webp' }],
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function fixture(initialRows: BackfillRow[], generated: Array<string | null> = []) {
  const rows = structuredClone(initialRows);
  const calls: QueryCall[] = [];
  const created: string[][] = [];
  let updateAllowed = true;
  let interruption: 'before-upload' | 'before-update' | 'after-update' | null = null;

  return {
    rows,
    calls,
    created,
    rejectUpdates() {
      updateAllowed = false;
    },
    interruptAt(point: 'before-upload' | 'before-update' | 'after-update' | null) {
      interruption = point;
    },
    dependencies: {
      async query<T>(sql: string, params: ReadonlyArray<unknown> = []): Promise<T[]> {
        calls.push({ sql, params });
        if (/^\s*SELECT/i.test(sql)) {
          const [limit, afterId] = params as [number, number];
          return rows
            .filter((candidate) => BigInt(candidate.id) > BigInt(afterId))
            .sort((left, right) => Number(BigInt(left.id) - BigInt(right.id)))
            .slice(0, limit) as T[];
        }
        if (/^\s*UPDATE/i.test(sql)) {
          if (interruption === 'before-update') throw new Error('interrupted before update');
          if (!updateAllowed) return [];
          const [id, renderIds, thumbUrl] = params as [number, string, string | null];
          const target = rows.find((candidate) => BigInt(candidate.id) === BigInt(id));
          if (!target) return [];
          target.render_ids = JSON.parse(renderIds) as unknown;
          target.thumb_url = thumbUrl;
          target.updated_at = '2099-01-01T00:00:00.000Z';
          if (interruption === 'after-update') throw new Error('interrupted after update');
          return [{ id }] as T[];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
      async createThumbnails(input: { imageUrls: string[] }): Promise<Array<string | null>> {
        if (interruption === 'before-upload') throw new Error('interrupted before upload');
        created.push(input.imageUrls);
        return generated.slice(0, input.imageUrls.length);
      },
    },
  };
}

test('default mode inventories candidates without invoking apply dependencies', async () => {
  const options = parseImageThumbnailBackfillOptions([], {});
  const state = fixture([row({ render_ids: ['https://media.example/original-1.png'] })]);

  const summary = await runImageThumbnailBackfill(options, state.dependencies);

  assert.equal(options.mode, 'dry-run');
  assert.deepEqual(summary, {
    scanned: 1,
    candidates: 1,
    updated: 0,
    skipped: 0,
    failed: 0,
    lastScannedId: '1',
    resumeAfterId: '1',
  });
  assert.equal(state.created.length, 0);
  assert.equal(state.calls.filter((call) => /^\s*UPDATE/i.test(call.sql)).length, 0);
});

test('--dry-run inventories candidates without invoking apply dependencies', async () => {
  const state = fixture([row({ render_ids: ['https://media.example/original-1.png'] })]);

  const summary = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--dry-run'], {}),
    state.dependencies
  );

  assert.equal(summary.updated, 0);
  assert.equal(state.created.length, 0);
  assert.ok(state.calls.every((call) => /^\s*SELECT/i.test(call.sql)));
});

test('--apply repairs one missing thumbnail and uses an optimistic update', async () => {
  const originalUrl = 'https://media.example/original-1.png';
  const thumbnailUrl = 'https://media.example/thumb-1.webp';
  const state = fixture([row({ render_ids: [originalUrl] })], [thumbnailUrl]);

  const summary = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--apply'], {}),
    state.dependencies
  );

  assert.deepEqual(summary, {
    scanned: 1,
    candidates: 1,
    updated: 1,
    skipped: 0,
    failed: 0,
    lastScannedId: '1',
    resumeAfterId: '1',
  });
  assert.deepEqual(state.created, [[originalUrl]]);
  assert.deepEqual(state.rows[0]?.render_ids, [
    { url: originalUrl, thumb_url: thumbnailUrl, width: null, height: null, mime_type: null },
  ]);
  const update = state.calls.find((call) => /^\s*UPDATE/i.test(call.sql));
  const select = state.calls.find((call) => /^\s*SELECT/i.test(call.sql));
  assert.ok(select);
  assert.match(select.sql, /updated_at::text AS updated_at/i);
  assert.ok(update);
  assert.match(update.sql, /updated_at IS NOT DISTINCT FROM \$4::timestamptz/i);
  assert.match(update.sql, /render_ids IS NOT DISTINCT FROM \$5::jsonb/i);
  assert.match(update.sql, /RETURNING id/i);
});

test('existing valid originals and thumbnails are skipped', async () => {
  const state = fixture([
    row({
      thumb_url: 'https://media.example/thumb-1.webp',
      render_ids: [{ url: 'https://media.example/original-1.png', thumb_url: 'https://media.example/thumb-1.webp' }],
    }),
  ]);

  const summary = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--apply'], {}),
    state.dependencies
  );

  assert.deepEqual(summary, {
    scanned: 1,
    candidates: 0,
    updated: 0,
    skipped: 1,
    failed: 0,
    lastScannedId: '1',
    resumeAfterId: '1',
  });
  assert.equal(state.created.length, 0);
  assert.ok(state.calls.every((call) => /^\s*SELECT/i.test(call.sql)));
});

test('conflicting and unknown flags are rejected', () => {
  assert.throws(
    () => parseImageThumbnailBackfillOptions(['--apply', '--dry-run'], {}),
    /cannot be used together/i
  );
  assert.throws(() => parseImageThumbnailBackfillOptions(['--surprise'], {}), /unknown option/i);
});

test('--after-id accepts the full PostgreSQL bigint range and rejects unsafe cursor values', () => {
  assert.equal(
    parseImageThumbnailBackfillOptions(['--after-id=9223372036854775807'], {}).afterId,
    '9223372036854775807'
  );
  assert.equal(parseImageThumbnailBackfillOptions(['--after-id', '0'], {}).afterId, '0');

  for (const args of [
    ['--after-id'],
    ['--after-id=-1'],
    ['--after-id=1.5'],
    ['--after-id=9223372036854775808'],
    ['--after-id=1', '--after-id=2'],
  ]) {
    assert.throws(() => parseImageThumbnailBackfillOptions(args, {}), /after id/i);
  }
});

test('ID pagination remains stable when updates change timestamps', async () => {
  const state = fixture(
    [1, 2, 3].map((id) => row({ id, job_id: `job-${id}`, render_ids: [`https://media.example/${id}.png`] })),
    ['https://media.example/generated.webp']
  );

  const summary = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--apply', '--batch-size=1', '--max=3'], {}),
    state.dependencies
  );

  assert.equal(summary.scanned, 3);
  assert.equal(summary.updated, 3);
  const selects = state.calls.filter((call) => /^\s*SELECT/i.test(call.sql));
  assert.deepEqual(selects.map((call) => call.params[1]), ['0', '1', '2']);
  assert.ok(selects.every((call) => /id > \$2/i.test(call.sql) && /ORDER BY id ASC/i.test(call.sql)));
});

test('a reported cursor resumes a later bounded invocation beyond the default starting point', async () => {
  const state = fixture(
    [1, 2, 3, 4].map((id) =>
      row({
        id,
        job_id: `job-${id}`,
        thumb_url: `https://media.example/${id}-thumb.webp`,
        render_ids: [
          { url: `https://media.example/${id}.png`, thumb_url: `https://media.example/${id}-thumb.webp` },
        ],
      })
    )
  );

  const first = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--dry-run', '--max=2'], {}),
    state.dependencies
  );
  const second = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--dry-run', '--max=2', `--after-id=${first.resumeAfterId}`], {}),
    state.dependencies
  );

  assert.equal(first.lastScannedId, '2');
  assert.equal(first.resumeAfterId, '2');
  assert.deepEqual(second, {
    scanned: 2,
    candidates: 0,
    updated: 0,
    skipped: 2,
    failed: 0,
    lastScannedId: '4',
    resumeAfterId: '4',
  });
  const selects = state.calls.filter((call) => /^\s*SELECT/i.test(call.sql));
  assert.equal(selects.at(-1)?.params[1], '2');
});

test('the exact database timestamp text is passed through to the optimistic update', async () => {
  const exactVersion = '2026-01-01 00:00:00.123456+00';
  const state = fixture([row({ updated_at: exactVersion, render_ids: ['https://media.example/original.png'] })], [
    'https://media.example/generated.webp',
  ]);

  await runImageThumbnailBackfill(parseImageThumbnailBackfillOptions(['--apply'], {}), state.dependencies);

  const update = state.calls.find((call) => /^\s*UPDATE/i.test(call.sql));
  assert.ok(update);
  assert.equal(update.params[3], exactVersion);
});

test('batch and total limits are finite, bounded, and enforced', async () => {
  for (const args of [
    ['--batch-size'],
    ['--batch-size=0'],
    ['--batch-size=101'],
    ['--max'],
    ['--max=0'],
    ['--max=10001'],
    ['--max=1.5'],
  ]) {
    assert.throws(() => parseImageThumbnailBackfillOptions(args, {}), /must be an integer between/i);
  }
  assert.throws(
    () => parseImageThumbnailBackfillOptions([], { IMAGE_THUMB_BACKFILL_MAX: 'Infinity' }),
    /must be an integer between/i
  );

  const state = fixture(
    [1, 2, 3].map((id) => row({ id, job_id: `job-${id}`, render_ids: [`https://media.example/${id}.png`] }))
  );
  const summary = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--dry-run', '--batch-size=2', '--max=2'], {}),
    state.dependencies
  );
  assert.equal(summary.scanned, 2);
  assert.equal(state.calls[0]?.params[0], 2);
});

test('partial thumbnail failure preserves originals and valid thumbnails while remaining retryable', async () => {
  const state = fixture(
    [
      row({
        thumb_url: 'https://media.example/old-hero.webp',
        render_ids: [
          { url: 'https://media.example/original-1.png' },
          { url: 'https://media.example/original-2.png', thumb_url: 'https://media.example/existing-2.webp' },
          { url: 'https://media.example/original-3.png' },
        ],
      }),
    ],
    ['https://media.example/new-1.webp', null]
  );

  const summary = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--apply'], {}),
    state.dependencies
  );

  assert.deepEqual(summary, {
    scanned: 1,
    candidates: 1,
    updated: 1,
    skipped: 0,
    failed: 1,
    lastScannedId: '1',
    resumeAfterId: '0',
  });
  assert.deepEqual(state.created, [[
    'https://media.example/original-1.png',
    'https://media.example/original-3.png',
  ]]);
  assert.deepEqual(state.rows[0]?.render_ids, [
    { url: 'https://media.example/original-1.png', thumb_url: 'https://media.example/new-1.webp', width: null, height: null, mime_type: null },
    { url: 'https://media.example/original-2.png', thumb_url: 'https://media.example/existing-2.webp', width: null, height: null, mime_type: null },
    { url: 'https://media.example/original-3.png', thumb_url: 'https://media.example/original-3.png', width: null, height: null, mime_type: null },
  ]);
  assert.equal(state.rows[0]?.thumb_url, 'https://media.example/old-hero.webp');
});

test('a failed repair does not update the row or increment success', async () => {
  const original = row({
    thumb_url: 'https://media.example/old-hero.webp',
    render_ids: [{ url: 'https://media.example/original.png' }],
  });
  const state = fixture([original], [null]);

  const summary = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--apply'], {}),
    state.dependencies
  );

  assert.deepEqual(summary, {
    scanned: 1,
    candidates: 1,
    updated: 0,
    skipped: 0,
    failed: 1,
    lastScannedId: '1',
    resumeAfterId: '0',
  });
  assert.deepEqual(state.rows[0], original);
  assert.ok(state.calls.every((call) => /^\s*SELECT/i.test(call.sql)));
});

test('a concurrent row change is not overwritten or counted as updated', async () => {
  const state = fixture([row({ render_ids: ['https://media.example/original.png'] })], [
    'https://media.example/generated.webp',
  ]);
  state.rejectUpdates();

  const summary = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--apply'], {}),
    state.dependencies
  );

  assert.deepEqual(summary, {
    scanned: 1,
    candidates: 1,
    updated: 0,
    skipped: 0,
    failed: 1,
    lastScannedId: '1',
    resumeAfterId: '0',
  });
});

test('an interruption before upload leaves the row retryable from the prior cursor', async () => {
  const originalUrl = 'https://media.example/original.png';
  const state = fixture([row({ render_ids: [originalUrl] })], ['https://media.example/generated.webp']);
  state.interruptAt('before-upload');

  const interrupted = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--apply'], {}),
    state.dependencies
  );
  state.interruptAt(null);
  const retried = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--apply', `--after-id=${interrupted.resumeAfterId}`], {}),
    state.dependencies
  );

  assert.equal(interrupted.updated, 0);
  assert.equal(interrupted.failed, 1);
  assert.equal(interrupted.lastScannedId, '1');
  assert.equal(interrupted.resumeAfterId, '0');
  assert.equal(retried.updated, 1);
  assert.deepEqual(state.created, [[originalUrl]]);
});

test('an interruption after upload but before update is failed and may upload again on retry', async () => {
  const originalUrl = 'https://media.example/original.png';
  const state = fixture([row({ render_ids: [originalUrl] })], ['https://media.example/generated.webp']);
  state.interruptAt('before-update');

  const interrupted = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--apply'], {}),
    state.dependencies
  );
  state.interruptAt(null);
  const retried = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--apply', `--after-id=${interrupted.resumeAfterId}`], {}),
    state.dependencies
  );

  assert.equal(interrupted.updated, 0);
  assert.equal(interrupted.failed, 1);
  assert.equal(interrupted.lastScannedId, '1');
  assert.equal(interrupted.resumeAfterId, '0');
  assert.equal(retried.updated, 1);
  assert.deepEqual(state.created, [[originalUrl], [originalUrl]]);
});

test('an interruption after update is reported failed but retry does not regenerate the durable thumbnail', async () => {
  const originalUrl = 'https://media.example/original.png';
  const generatedUrl = 'https://media.example/generated.webp';
  const state = fixture([row({ render_ids: [originalUrl] })], [generatedUrl]);
  state.interruptAt('after-update');

  const interrupted = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--apply'], {}),
    state.dependencies
  );
  state.interruptAt(null);
  const retried = await runImageThumbnailBackfill(
    parseImageThumbnailBackfillOptions(['--apply', `--after-id=${interrupted.resumeAfterId}`], {}),
    state.dependencies
  );

  assert.equal(interrupted.updated, 0);
  assert.equal(interrupted.failed, 1);
  assert.equal(interrupted.lastScannedId, '1');
  assert.equal(interrupted.resumeAfterId, '0');
  assert.equal(retried.updated, 0);
  assert.equal(retried.skipped, 1);
  assert.deepEqual(state.created, [[originalUrl]]);
  assert.deepEqual(state.rows[0]?.render_ids, [
    { url: originalUrl, thumb_url: generatedUrl, width: null, height: null, mime_type: null },
  ]);
});

test('apply failures return a nonzero operational exit code after reporting their summary', () => {
  const apply = parseImageThumbnailBackfillOptions(['--apply'], {});
  const dryRun = parseImageThumbnailBackfillOptions(['--dry-run'], {});
  const failedSummary = {
    scanned: 1,
    candidates: 1,
    updated: 0,
    skipped: 0,
    failed: 1,
    lastScannedId: '1',
    resumeAfterId: '0',
  };

  assert.equal(getImageThumbnailBackfillExitCode(apply, failedSummary), 1);
  assert.equal(getImageThumbnailBackfillExitCode(dryRun, failedSummary), 0);
  assert.equal(getImageThumbnailBackfillExitCode(apply, { ...failedSummary, failed: 0, updated: 1 }), 0);
});
