import assert from 'node:assert/strict';
import { constants as fsConstants } from 'node:fs';
import { access, copyFile, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ensureExecutableFfmpegPath } from '../frontend/server/ffmpeg-runtime.ts';
import type { EnsureFastStartVideoDependencies } from '../frontend/server/video-faststart.ts';

const DURABLE_URL = 'https://durable.example.test/video.mp4';
const SOURCE_URL = 'https://provider.example.test/video.mp4';
const BODY_BYTES = Uint8Array.from([
  0, 0, 0, 24,
  102, 116, 121, 112,
  105, 115, 111, 109,
  0, 0, 2, 0,
  105, 115, 111, 109,
  105, 115, 111, 50,
]);

type TimerCallback = (...args: unknown[]) => void;

class ManualTimerScheduler {
  private nowMs = 0;
  private nextId = 1;
  private readonly timers = new Map<number, { atMs: number; callback: TimerCallback; args: unknown[] }>();

  readonly setTimeout = ((callback: TimerCallback, delayMs = 0, ...args: unknown[]) => {
    const id = this.nextId++;
    this.timers.set(id, {
      atMs: this.nowMs + Math.max(0, Number(delayMs) || 0),
      callback,
      args,
    });
    return id;
  }) as unknown as typeof setTimeout;

  readonly clearTimeout = ((handle?: ReturnType<typeof setTimeout>) => {
    this.timers.delete(Number(handle));
  }) as typeof clearTimeout;

  advanceBy(durationMs: number) {
    const targetMs = this.nowMs + durationMs;
    while (true) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.atMs <= targetMs)
        .sort((left, right) => left[1].atMs - right[1].atMs || left[0] - right[0])[0];
      if (!next) break;
      const [id, timer] = next;
      this.timers.delete(id);
      this.nowMs = timer.atMs;
      timer.callback(...timer.args);
    }
    this.nowMs = targetMs;
  }
}

type DelayedBodyFetch = {
  fetchFn: typeof fetch;
  bodyStarted: Promise<void>;
  completeBody: () => void;
  getSignal: () => AbortSignal | null;
};

function createDelayedBodyFetch(): DelayedBodyFetch {
  let resolveBodyStarted!: () => void;
  let resolveBody!: (value: ArrayBuffer) => void;
  let rejectBody!: (reason: unknown) => void;
  let settled = false;
  let signal: AbortSignal | null = null;
  const bodyStarted = new Promise<void>((resolve) => {
    resolveBodyStarted = resolve;
  });
  const body = new Promise<ArrayBuffer>((resolve, reject) => {
    resolveBody = resolve;
    rejectBody = reject;
  });

  const fetchFn = (async (_input: string | URL | Request, init?: RequestInit) => {
    signal = init?.signal ?? null;
    signal?.addEventListener(
      'abort',
      () => {
        if (settled) return;
        settled = true;
        const error = new Error('This operation was aborted');
        error.name = 'AbortError';
        rejectBody(error);
      },
      { once: true }
    );
    return {
      ok: true,
      status: 200,
      headers: new Headers({
        'content-length': String(BODY_BYTES.byteLength),
        'content-type': 'video/mp4',
      }),
      arrayBuffer: () => {
        resolveBodyStarted();
        return body;
      },
    } as Response;
  }) as typeof fetch;

  return {
    fetchFn,
    bodyStarted,
    completeBody: () => {
      if (settled) return;
      settled = true;
      resolveBody(BODY_BYTES.slice().buffer);
    },
    getSignal: () => signal,
  };
}

async function loadEnsureFastStartVideo() {
  const module = await import('../frontend/server/video-faststart');
  return module.ensureFastStartVideo;
}

function installControlledBoundaries(scheduler: ManualTimerScheduler, delayedFetch: DelayedBodyFetch) {
  const original = {
    fetch: globalThis.fetch,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    warn: console.warn,
  };
  globalThis.fetch = delayedFetch.fetchFn;
  globalThis.setTimeout = scheduler.setTimeout;
  globalThis.clearTimeout = scheduler.clearTimeout;
  console.warn = () => undefined;
  return () => {
    globalThis.fetch = original.fetch;
    globalThis.setTimeout = original.setTimeout;
    globalThis.clearTimeout = original.clearTimeout;
    console.warn = original.warn;
  };
}

function createDependencies(delayedFetch: DelayedBodyFetch, uploaded: Buffer[]): EnsureFastStartVideoDependencies {
  return {
    fetchFn: delayedFetch.fetchFn,
    isStorageConfiguredFn: () => true,
    isStorageUrlFn: () => false,
    getFfmpegPathFn: () => '/test/ffmpeg',
    ensureExecutableFfmpegPathFn: async (path) => path,
    runFastStartFn: async (_ffmpegPath, inputPath, outputPath) => {
      await copyFile(inputPath, outputPath);
    },
    uploadFileBufferFn: async ({ data }) => {
      uploaded.push(data);
      return { key: 'durable/test-video.mp4', url: DURABLE_URL };
    },
  };
}

test('copies a non-executable ffmpeg binary to an executable temp path', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mv-ffmpeg-test-'));
  try {
    const source = path.join(dir, 'ffmpeg');
    await writeFile(source, '#!/bin/sh\nexit 0\n', { mode: 0o644 });

    const executable = await ensureExecutableFfmpegPath(source);

    assert.notEqual(executable, source);
    await access(executable, fsConstants.X_OK);
    assert.equal((await stat(executable)).isFile(), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('server ffmpeg callers normalize the packaged binary before execFile', async () => {
  const ffmpegCallers = [
    'frontend/server/thumbnails.ts',
    'frontend/server/video-keyframes.ts',
    'frontend/server/video-preview.ts',
    'frontend/server/upload-thumbnails.ts',
    'frontend/src/server/audio/media.ts',
    'frontend/server/video-faststart.ts',
  ];

  for (const relativePath of ffmpegCallers) {
    const source = await readFile(path.join(process.cwd(), relativePath), 'utf8');
    assert.match(source, /ensureExecutableFfmpegPath/, `${relativePath} should normalize ffmpeg permissions`);
  }
});

test('a valid body completing after 45 seconds still reaches durable upload', { concurrency: false }, async () => {
  const ensureFastStartVideo = await loadEnsureFastStartVideo();
  const scheduler = new ManualTimerScheduler();
  const delayedFetch = createDelayedBodyFetch();
  const uploaded: Buffer[] = [];
  const restore = installControlledBoundaries(scheduler, delayedFetch);
  let resultPromise: Promise<string | null> | null = null;

  try {
    resultPromise = ensureFastStartVideo(
      { jobId: 'test-slow-valid-body', userId: 'test-user', videoUrl: SOURCE_URL },
      createDependencies(delayedFetch, uploaded)
    );
    await delayedFetch.bodyStarted;

    scheduler.advanceBy(50_000);
    delayedFetch.completeBody();

    assert.equal(await resultPromise, DURABLE_URL);
    assert.equal(uploaded.length, 1);
    assert.deepEqual(uploaded[0], Buffer.from(BODY_BYTES));
  } finally {
    await resultPromise?.catch(() => null);
    restore();
  }
});

test('uses the configured render storage prefix for the durable video copy', { concurrency: false }, async () => {
  const ensureFastStartVideo = await loadEnsureFastStartVideo();
  let uploadedPrefix: string | undefined;
  const previousPrefix = process.env.VIDEO_RENDER_STORAGE_PREFIX;
  process.env.VIDEO_RENDER_STORAGE_PREFIX = 'mcp-render-staging/';

  try {
    const result = await ensureFastStartVideo(
      { jobId: 'test-staging-prefix', userId: 'test-user', videoUrl: SOURCE_URL },
      {
        fetchFn: async () => new Response(BODY_BYTES, {
          status: 200,
          headers: {
            'content-length': String(BODY_BYTES.byteLength),
            'content-type': 'video/mp4',
          },
        }),
        isStorageConfiguredFn: () => true,
        isStorageUrlFn: () => false,
        getFfmpegPathFn: () => '/test/ffmpeg',
        ensureExecutableFfmpegPathFn: async (path) => path,
        runFastStartFn: async (_ffmpegPath, inputPath, outputPath) => {
          await copyFile(inputPath, outputPath);
        },
        uploadFileBufferFn: async ({ prefix }) => {
          uploadedPrefix = prefix;
          return { key: 'durable/test-video.mp4', url: DURABLE_URL };
        },
      }
    );

    assert.equal(result, DURABLE_URL);
    assert.equal(uploadedPrefix, 'mcp-render-staging/');
  } finally {
    if (previousPrefix === undefined) {
      delete process.env.VIDEO_RENDER_STORAGE_PREFIX;
    } else {
      process.env.VIDEO_RENDER_STORAGE_PREFIX = previousPrefix;
    }
  }
});

test('a body exceeding the 120 second budget is aborted before upload', { concurrency: false }, async () => {
  const ensureFastStartVideo = await loadEnsureFastStartVideo();
  const scheduler = new ManualTimerScheduler();
  const delayedFetch = createDelayedBodyFetch();
  const uploaded: Buffer[] = [];
  const restore = installControlledBoundaries(scheduler, delayedFetch);
  let resultPromise: Promise<string | null> | null = null;

  try {
    resultPromise = ensureFastStartVideo(
      { jobId: 'test-over-budget-body', userId: 'test-user', videoUrl: SOURCE_URL },
      createDependencies(delayedFetch, uploaded)
    );
    await delayedFetch.bodyStarted;

    scheduler.advanceBy(119_999);
    assert.equal(delayedFetch.getSignal()?.aborted, false);

    scheduler.advanceBy(1);
    assert.equal(await resultPromise, null);
    assert.equal(uploaded.length, 0);
  } finally {
    await resultPromise?.catch(() => null);
    restore();
  }
});
