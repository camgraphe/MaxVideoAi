import assert from 'node:assert/strict';
import test from 'node:test';
import { mapGenerationStatusRecordToAgent, mapGenerationStatusRecordToWeb } from '../frontend/src/server/generations/generation-status';
import { getInlinePreviewUrl, resolvePrimaryMediaUrl } from '../frontend/components/groups/composite-preview-dock-utils';
import { mapSelectedPreviewToGroup } from '../frontend/lib/video-preview-group';
import { createGenerationDownloadDescriptor } from '../frontend/src/server/mcp/tools/present-generation';
import { applyGenerationPollToRender, applyGenerationPollToSelectedPreview, projectGenerationPollStatus } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-polling';
import { mapRecentGenerationRecordToWeb } from '../frontend/src/server/generations/recent-generations';
import { buildGenerationResultAppHtml } from '../frontend/src/server/mcp/generation-result-app';
import { JSDOM } from 'jsdom';
const original = 'https://media.maxvideoai.com/renders/owner/original.mov';
const playback = 'https://media.maxvideoai.com/renders/owner/playback.mp4';
const frame = 'https://media.maxvideoai.com/renders/owner/last.jpg';
const snapshot = { byteplusDurableOutput: { providerJobId: 'cgt-owned', videoUrl: original,
  playbackVideoUrl: playback, lastFrame: { url: frame, mimeType: 'image/jpeg', sha256: 'a'.repeat(64), sizeBytes: 123, width: 64, height: 48 } } };

test('owned result DTO exposes full playback and returned JPEG separately from original and poster', () => {
  const record = { job_id: 'owned', provider_job_id: 'cgt-owned', status: 'completed', surface: 'video', video_url: original,
    engine_id: 'seedance-2-5', thumb_url: 'https://media.maxvideoai.com/poster.jpg', settings_snapshot: snapshot } as never;
  const result = mapGenerationStatusRecordToAgent(record)?.result as unknown as Record<string, unknown>;
  assert.equal(result.videoUrl, original);
  assert.equal(result.playbackVideoUrl, playback);
  assert.equal(result.lastFrameUrl, frame);
  const web = mapGenerationStatusRecordToWeb(record) as Record<string, unknown>;
  assert.equal(web.playbackVideoUrl, playback);
  assert.equal(web.lastFrameUrl, frame);
  assert.equal((mapGenerationStatusRecordToWeb({ ...record as object, provider_job_id: 'other' } as never) as Record<string, unknown>).lastFrameUrl, undefined);
});

test('workspace full player selects playback derivative while download identity stays MOV', () => {
  const group = mapSelectedPreviewToGroup({ id: 'owned', videoUrl: original, playbackVideoUrl: playback,
    lastFrameUrl: frame, status: 'completed' } as never, 'fal')!;
  assert.equal(getInlinePreviewUrl(group.items[0]), playback);
  assert.equal(resolvePrimaryMediaUrl(group), original);
  assert.equal(group.items[0].lastFrameUrl, frame);
});

test('MOV download descriptors retain the original extension and JPEG download resolves distinct output', async () => {
  const recovery = { jobId: 'owned', surface: 'video', status: 'completed', result: { surface: 'video', videoUrl: original,
    playbackVideoUrl: playback, lastFrameUrl: frame, previewUrl: null, thumbnailUrl: null, audioUrl: null } } as never;
  const download = await createGenerationDownloadDescriptor(recovery, { extractStorageKeyFromUrl: () => 'renders/owner/original.mov',
    createSignedDownloadUrl: async (_key, options) => { assert.equal(options?.downloadFilename, 'maxvideoai-owned.mov'); return 'https://media.maxvideoai.com/signed.mov'; } });
  assert.equal(download?.filename, 'maxvideoai-owned.mov');
  const jpeg = await createGenerationDownloadDescriptor(recovery, { extractStorageKeyFromUrl: url => {
    assert.equal(url, frame); return 'renders/owner/last.jpg'; },
    createSignedDownloadUrl: async (_key, options) => { assert.equal(options?.downloadFilename, 'maxvideoai-owned-last-frame.jpg'); return 'https://media.maxvideoai.com/signed.jpg'; } }, 'last_frame');
  assert.equal(jpeg?.filename, 'maxvideoai-owned-last-frame.jpg');
});

test('polling and recent history retain full playback and frame identities', () => {
  const status = { status: 'completed', videoUrl: original, playbackVideoUrl: playback, lastFrameUrl: frame };
  const projection = projectGenerationPollStatus({ status, jobId: 'owned', localKey: 'local', now: Date.now() } as never);
  const next = applyGenerationPollToRender({ id: 'owned', jobId: 'owned', localKey: 'local' } as never, projection) as unknown as Record<string, unknown>;
  assert.equal(next.playbackVideoUrl, playback);
  assert.equal(next.lastFrameUrl, frame);
  const selected = applyGenerationPollToSelectedPreview({ id: 'owned', localKey: 'local' }, projection) as Record<string, unknown>;
  assert.equal(selected.lastFrameUrl, frame);
  const recent = mapRecentGenerationRecordToWeb({ video_url: original, provider_job_id: 'cgt-owned', settings_snapshot: snapshot } as never) as Record<string, unknown>;
  assert.equal(recent.playbackVideoUrl, playback);
  assert.equal(recent.lastFrameUrl, frame);
});

test('a changed original clears client playback and returned-frame bindings', () => {
  const changed = projectGenerationPollStatus({ status: { status: 'completed', videoUrl: 'https://media.maxvideoai.com/replaced.mp4' },
    jobId: 'owned', localKey: 'local', now: Date.now() });
  const previous = { id: 'owned', jobId: 'owned', localKey: 'local', videoUrl: original,
    playbackVideoUrl: playback, lastFrameUrl: frame };
  const next = applyGenerationPollToRender(previous as never, changed);
  assert.equal(next.playbackVideoUrl, undefined);
  assert.equal(next.lastFrameUrl, undefined);
});

test('MCP result app plays the full derivative and exposes independent JPEG download and reuse actions', async () => {
  const opened: string[] = [];
  const calls: Array<{ name: string; arguments: Record<string, string> }> = [];
  const dom = new JSDOM(buildGenerationResultAppHtml(), { url: 'https://maxvideoai.com', runScripts: 'dangerously',
    pretendToBeVisual: true, beforeParse(window) {
      window.HTMLMediaElement.prototype.pause = () => {};
      window.HTMLMediaElement.prototype.load = () => {};
      window.postMessage = (message: { id: number; method: string; params: { name: string; arguments: Record<string, string> } }) => {
        if (message.method !== 'tools/call') return;
        calls.push(message.params);
        queueMicrotask(() => window.dispatchEvent(new window.MessageEvent('message', { source: window,
          data: { jsonrpc: '2.0', id: message.id, result: { structuredContent: { download: { url: 'https://media.maxvideoai.com/signed-last.jpg' } } } } })));
      };
      (window as unknown as { openai: unknown }).openai = { openExternal: async ({ href }: { href: string }) => { opened.push(href); },
        toolOutput: { jobId: 'owned', surface: 'video', status: 'completed',
        result: { surface: 'video', videoUrl: original, playbackVideoUrl: playback, lastFrameUrl: frame },
        library: { url: 'https://maxvideoai.com/app/library' } } };
    } });
  try {
    assert.equal((dom.window.document.getElementById('video') as HTMLVideoElement).src, playback);
    assert.equal((dom.window.document.getElementById('last-frame-download') as HTMLButtonElement)?.disabled, false);
    assert.equal((dom.window.document.getElementById('last-frame-reuse') as HTMLButtonElement)?.disabled, false);
    (dom.window.document.getElementById('last-frame-download') as HTMLButtonElement).click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ name: 'get_generation_download', arguments: { jobId: 'owned', outputRole: 'last_frame' } }]);
    assert.equal(opened[0], 'https://media.maxvideoai.com/signed-last.jpg');
    (dom.window.document.getElementById('last-frame-reuse') as HTMLButtonElement).click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(opened[1], 'https://maxvideoai.com/app/library?view=review&kind=image&job=owned');
    (dom.window.document.getElementById('last-frame-download') as HTMLButtonElement).click();
    dom.window.dispatchEvent(new dom.window.MessageEvent('message', { source: dom.window,
      data: { jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: {
        jobId: 'another-owned', surface: 'video', status: 'completed',
        result: { surface: 'video', videoUrl: 'https://media.maxvideoai.com/another.mp4' },
      } } } }));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(opened.length, 2, 'a late frame descriptor must not open after the result changes');
    assert.equal((dom.window.document.getElementById('last-frame-download') as HTMLButtonElement).disabled, true);
  } finally { dom.window.close(); }
});
