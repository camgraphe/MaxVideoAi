import assert from 'node:assert/strict';
import test from 'node:test';
import { getMediaInputEligibility, getKlingElementMediaEligibility } from '../frontend/lib/media-input-eligibility';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { resolveVideoOperationEngine } from '../frontend/lib/video-operation';
import type { EngineCaps, Mode } from '../frontend/types/engines';
const engine = (id: string) => { const result = listFalEngines().find(entry => entry.id === id)?.engine; assert.ok(result); return result; };
const video = { kind: 'video' as const, url: 'https://owned.example/original.mp4?sig=Exact%2F', mime: 'video/mp4', size: 1000, durationSec: 8 };

test('Kling element slots share known dimension and kind constraints without inventing missing facts', () => {
  const image = { kind: 'image' as const, url: 'https://owned.example/original.png', mime: 'image/png', width: 64, height: 64 };
  for (const slot of ['frontal', 'reference'] as const) {
    assert.equal(getKlingElementMediaEligibility(image, slot).issue, 'dimensions');
    assert.equal(getKlingElementMediaEligibility({ ...image, width: 300, height: 300 }, slot).status, 'usable');
    assert.equal(getKlingElementMediaEligibility({ ...image, width: undefined, height: undefined }, slot).status, 'unverified');
    assert.equal(getKlingElementMediaEligibility(video, slot).issue, 'kind');
  }
  assert.equal(getKlingElementMediaEligibility(image, 'video').issue, 'kind');
  assert.equal(getKlingElementMediaEligibility(video, 'video').status, 'unverified');
  assert.equal(getKlingElementMediaEligibility({ ...video, width: 1920, height: 1080 }, 'video').status, 'usable');
});
function assess(id: string, mode: Mode, fieldId: string, facts: Partial<typeof video> & { width?: number; height?: number } = {}, operation?: string) {
  const base = engine(id); const value = operation ? resolveVideoOperationEngine(base, mode, operation) : base;
  const field = [...(value.inputSchema?.required ?? []), ...(value.inputSchema?.optional ?? [])]
    .find(field => field.id === fieldId && (!field.modes?.length || field.modes.includes(mode)))!;
  assert.ok(field, `${id}:${mode}:${fieldId}`);
  return getMediaInputEligibility({ asset: { ...video, ...facts }, field, engine: value, mode });
}

test('source selection uses the selected operation limits and never requested output timing', () => {
  for (const [id, mode, field, operation, durationSec, status] of [
    ['minimax-h3-max', 'v2v', 'video_url', 'h3-recast', 4, 'blocked'],
    ['minimax-h3-max', 'v2v', 'video_url', 'h3-recast', 20, 'usable'],
    ['minimax-h3-max', 'v2v', 'video_url', 'h3-recast', 31, 'excerpt_required'],
    ['minimax-h3-max', 'v2v', 'video_url', 'h3-relight', 20, 'excerpt_required'],
    ['luma-ray-3-2', 'v2v', 'video_url', undefined, 12, 'usable'],
    ['luma-ray-3-2', 'reframe', 'video_url', undefined, 12, 'excerpt_required'],
    ['kling-o3-pro', 'v2v', 'video_url', 'kling-edit', 2, 'blocked'],
    ['kling-o3-pro', 'v2v', 'video_url', 'kling-edit', 16, 'excerpt_required'],
    ['seedance-2-5', 'extend', 'extension_source_videos', undefined, 31, 'excerpt_required'],
  ] as const) assert.equal(assess(id, mode, field, { durationSec }, operation).status, status, `${id}:${operation ?? mode}:${durationSec}`);
});

test('only a too-long source within worker bounds may defer its final size check until a section is prepared', () => {
  const e = engine('minimax-h3');
  const field = e.inputSchema!.optional!.find(field => field.id === 'reference_video_urls')!;
  assert.ok(field);
  const check = (durationSec: number, size: number, context: 'stored' | 'file' = 'stored') => getMediaInputEligibility({ asset: { ...video, durationSec, size }, field, engine: e, mode: 'ref2v', context });
  assert.equal(check(30, 60 * 1024 * 1024).status, 'excerpt_required');
  assert.equal(check(8, 60 * 1024 * 1024).issue, 'size');
  assert.equal(check(30, 60 * 1024 * 1024, 'file').issue, 'size');
  assert.equal(check(181, 1000).status, 'blocked');
  assert.equal(check(30, 101 * 1024 * 1024).status, 'blocked');
});

test('a source workflow cannot borrow a creation reference field', () => {
  const e = engine('wan-3');
  const field = e.inputSchema!.optional!.find(field => field.id === 'reference_video_urls')!;
  assert.equal(getMediaInputEligibility({ asset: video, field, engine: e, mode: 'v2v' }).status, 'blocked');
  assert.equal(getMediaInputEligibility({ asset: { ...video, durationSec: 20 }, field, engine: e, mode: 't2v' }).status, 'excerpt_required');
});

test('known source geometry follows specialist and runtime constraints while unknown dimensions stay selectable', () => {
  assert.equal(assess('kling-o3-pro', 'v2v', 'video_url', { width: 320, height: 180 }, 'kling-edit').issue, 'dimensions');
  assert.equal(assess('kling-o3-pro', 'v2v', 'video_url', { width: 1280, height: 720 }, 'kling-edit').status, 'usable');
  assert.equal(assess('kling-o3-pro', 'v2v', 'video_url', {}, 'kling-edit').status, 'unverified');
  assert.equal(assess('seedance-2-5', 'v2v', 'video_url', { width: 320, height: 180 }).issue, 'dimensions');
  assert.equal(assess('seedance-2-5', 'v2v', 'video_url', { width: 1280, height: 720 }).status, 'usable');
  assert.equal(assess('minimax-h3-max', 'v2v', 'video_url', {}, 'h3-relight').status, 'unverified');
});

test('FAST Edit retains strict byte and duration boundaries instead of rounding schema MB or seconds', () => {
  assert.equal(assess('flux-3', 'v2v', 'video_url', { durationSec: 15 }, 'flux-fast-edit').status, 'excerpt_required');
  assert.equal(assess('flux-3', 'v2v', 'video_url', { durationSec: 14.9, size: 50_000_000 }, 'flux-fast-edit').issue, 'size');
  assert.equal(assess('flux-3', 'v2v', 'video_url', { durationSec: 14.9, size: 49_999_999 }, 'flux-fast-edit').status, 'usable');
});

test('the complete runtime media slot and operation matrix rejects only known bad facts', (t) => {
  let slots = 0; const models = new Set<string>(); const operations = new Set<string>();
  for (const entry of listFalEngines().filter(entry => entry.category !== 'image')) {
    const variants: EngineCaps[] = [entry.engine];
    for (const [operation, caps] of Object.entries(entry.engine.operationCaps ?? {})) {
      if (!caps) continue;
      variants.push(resolveVideoOperationEngine(entry.engine, caps.mode, operation)); operations.add(operation);
    }
    for (const e of variants) for (const mode of e.modes) {
      if (e.modeAvailability?.[mode]?.available === false) continue;
      for (const field of [...(e.inputSchema?.required ?? []), ...(e.inputSchema?.optional ?? [])]) {
        if (!['image', 'video', 'audio'].includes(field.type) || (field.modes?.length && !field.modes.includes(mode))) continue;
        const kind = field.type as 'image' | 'video' | 'audio';
        const asset = { kind, url: 'https://owned.example/opaque?signature=Exact%2F' };
        const original = JSON.stringify(asset);
        const assess = (patch = {}) => getMediaInputEligibility({ asset: { ...asset, ...patch }, field, engine: e, mode });
        const label = `${e.id}:${e.activeVideoOperation ?? 'default'}:${mode}:${field.id}`;
        assert.notEqual(assess().status, 'blocked', `${label} must not reject missing metadata`);
        assert.equal(assess({ kind: kind === 'image' ? 'video' : 'image' }).issue, 'kind', label);
        assert.equal(assess({ mime: 'application/x-invalid-media' }).issue, 'format', label);
        assert.equal(JSON.stringify(asset), original, 'eligibility does not rewrite identity');
        slots++; models.add(e.id);
      }
    }
  }
  assert.ok(slots > 100); assert.ok(models.size > 10); assert.ok(operations.has('h3-relight'));
  t.diagnostic(`${models.size} models, ${operations.size} operations, ${slots} model/mode/slot cases audited`);
});
