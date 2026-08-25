import assert from 'node:assert/strict';
import test from 'node:test';

type TimeoutPolicy = (params: {
  createdAt: string;
  settingsSnapshot: unknown;
  nowMs: number;
  maxDurationMs: number;
}) => boolean;

async function loadTimeoutPolicy(): Promise<TimeoutPolicy | undefined> {
  const module = await import('../frontend/server/byteplus-storage-copy.ts');
  return (module as { shouldApplyBytePlusProviderTimeout?: TimeoutPolicy })
    .shouldApplyBytePlusProviderTimeout;
}

test('keeps a provider-completed job active while its durable copy is retrying', async () => {
  const shouldApplyTimeout = await loadTimeoutPolicy();
  const createdAt = '2026-08-25T20:00:00.000Z';
  const nowMs = Date.parse('2026-08-25T20:36:00.000Z');

  const timedOut = shouldApplyTimeout?.({
    createdAt,
    nowMs,
    maxDurationMs: 35 * 60_000,
    settingsSnapshot: {
      byteplusStorageCopy: {
        attempts: 1,
        firstFailedAt: '2026-08-25T20:25:00.000Z',
        lastFailedAt: '2026-08-25T20:25:00.000Z',
        nextRetryAt: '2026-08-25T20:27:00.000Z',
        lastProviderStatus: 'succeeded',
        lastReason: 'provider_video_copy_failed',
      },
    },
  });

  assert.equal(timedOut, false);
});

test('still times out an old provider job before any durable-copy attempt', async () => {
  const shouldApplyTimeout = await loadTimeoutPolicy();
  const createdAt = '2026-08-25T20:00:00.000Z';
  const nowMs = Date.parse('2026-08-25T20:36:00.000Z');

  const timedOut = shouldApplyTimeout?.({
    createdAt,
    nowMs,
    maxDurationMs: 35 * 60_000,
    settingsSnapshot: {},
  });

  assert.equal(timedOut, true);
});
