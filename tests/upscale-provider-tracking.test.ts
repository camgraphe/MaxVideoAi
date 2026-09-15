import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const modulePath = `${process.cwd()}/frontend/src/server/tools/upscale-provider-submission.ts`;

test('upscale provider tracking is durable before the long Fal status wait starts', async () => {
  assert.ok(existsSync(modulePath), 'the durable upscale provider submission helper should exist');
  const submissionModule = await import(pathToFileURL(modulePath).href) as {
    runDurablyTrackedUpscaleRequest?: (params: {
      modelId: string;
      input: Record<string, unknown>;
      persistProviderJobId(requestId: string): Promise<void>;
      onQueueUpdate(update: unknown): void;
      queue: {
        submit(modelId: string, options: { input: Record<string, unknown> }): Promise<{ request_id: string }>;
        subscribeToStatus(modelId: string, options: {
          requestId: string;
          mode: 'polling';
          onQueueUpdate(update: unknown): void;
        }): Promise<unknown>;
        result(modelId: string, options: { requestId: string }): Promise<unknown>;
      };
    }) => Promise<{ providerJobId: string; result: unknown }>;
  };
  assert.equal(typeof submissionModule.runDurablyTrackedUpscaleRequest, 'function');

  let releasePersistence!: () => void;
  let persistenceStarted!: () => void;
  const persistenceGate = new Promise<void>((resolve) => { releasePersistence = resolve; });
  const enteredPersistence = new Promise<void>((resolve) => { persistenceStarted = resolve; });
  const events: string[] = [];
  const providerResult = {
    requestId: 'fal-upscale-request',
    data: { video: { url: 'https://example.test/upscaled.mp4' } },
  };

  const request = submissionModule.runDurablyTrackedUpscaleRequest!({
    modelId: 'fal-ai/seedvr/upscale/video',
    input: { video_url: 'https://example.test/source.mp4' },
    persistProviderJobId: async (requestId) => {
      assert.equal(requestId, 'fal-upscale-request');
      events.push('persist:start');
      persistenceStarted();
      await persistenceGate;
      events.push('persist:done');
    },
    onQueueUpdate: () => { events.push('queue:update'); },
    queue: {
      async submit() {
        events.push('submit');
        return { request_id: 'fal-upscale-request' };
      },
      async subscribeToStatus(_modelId, options) {
        assert.equal(options.requestId, 'fal-upscale-request');
        events.push('status:wait');
        options.onQueueUpdate({ status: 'COMPLETED', request_id: options.requestId });
      },
      async result(_modelId, options) {
        assert.equal(options.requestId, 'fal-upscale-request');
        events.push('result');
        return providerResult;
      },
    },
  });

  await enteredPersistence;
  assert.deepEqual(events, ['submit', 'persist:start']);
  releasePersistence();

  assert.deepEqual(await request, {
    providerJobId: 'fal-upscale-request',
    result: providerResult,
  });
  assert.deepEqual(events, [
    'submit',
    'persist:start',
    'persist:done',
    'status:wait',
    'queue:update',
    'result',
  ]);
});
