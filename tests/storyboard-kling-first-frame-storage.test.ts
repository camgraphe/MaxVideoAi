import assert from 'node:assert/strict';
import test from 'node:test';
import {
  KLING_FIRST_FRAME_STORAGE_KEY,
  buildKlingFirstFrameFromRecentOutput,
  getStoredKlingFirstFrame,
  readStoredKlingFirstFrames,
  writeStoredKlingFirstFrame,
  type KlingFirstFrameState,
} from '../frontend/src/components/tools/storyboard/_lib/storyboard-kling-first-frame-storage.ts';

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

const frame: KlingFirstFrameState = {
  storyboardJobId: 'storyboard-job',
  storyboardUrl: 'https://cdn/storyboard.png',
  image: {
    url: 'https://cdn/first-frame.png',
    thumbUrl: 'https://cdn/first-frame-thumb.png',
    width: 1536,
    height: 1024,
    mimeType: 'image/png',
  },
  jobId: 'first-frame-job',
};

test('returns an empty map for malformed Kling first-frame storage', () => {
  const storage = createMemoryStorage({
    'maxvideoai.storyboard.klingFirstFrames.v1': '{broken',
  });

  assert.equal(KLING_FIRST_FRAME_STORAGE_KEY, 'maxvideoai.storyboard.klingFirstFrames.v1');
  assert.deepEqual(readStoredKlingFirstFrames(storage), {});
});

test('writes and reads a first frame by storyboard job and URL', () => {
  const storage = createMemoryStorage();

  writeStoredKlingFirstFrame(frame, storage);

  assert.equal(
    storage.getItem(KLING_FIRST_FRAME_STORAGE_KEY),
    JSON.stringify({ 'storyboard-job': frame })
  );
  assert.deepEqual(
    getStoredKlingFirstFrame('storyboard-job', 'https://cdn/storyboard.png', storage),
    frame
  );
});

test('rejects a stored first frame when the storyboard URL differs', () => {
  const storage = createMemoryStorage();
  writeStoredKlingFirstFrame(frame, storage);

  assert.equal(
    getStoredKlingFirstFrame('storyboard-job', 'https://cdn/other.png', storage),
    null
  );
});

test('maps a recent output Kling frame to the persisted state shape', () => {
  const recentOutput = {
    id: 'storyboard-output',
    jobId: 'storyboard-job',
    url: 'https://cdn/storyboard.png',
    thumbUrl: null,
    previewUrl: null,
    width: 1536,
    height: 1024,
    mime: 'image/png',
    createdAt: '2026-07-14T09:00:00.000Z',
    isSaved: true,
    klingFirstFrame: {
      id: 'first-frame-output',
      jobId: 'first-frame-job',
      url: 'https://cdn/first-frame.png',
      thumbUrl: null,
      previewUrl: 'https://cdn/first-frame-preview.png',
      width: 1536,
      height: 1024,
      mime: 'image/png',
      createdAt: '2026-07-14T09:01:00.000Z',
    },
  };
  const expectedFrame: KlingFirstFrameState = {
    ...frame,
    image: {
      ...frame.image,
      thumbUrl: 'https://cdn/first-frame-preview.png',
    },
  };

  assert.deepEqual(buildKlingFirstFrameFromRecentOutput(recentOutput), expectedFrame);
});
