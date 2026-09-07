import assert from 'node:assert/strict';
import { recentMediaFilename } from '../frontend/components/library/recent-media-copy';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildRecentOutputsKey, type RecentOutput } from '../frontend/app/(core)/(workspace)/app/library/_lib/library-page-helpers';
import { getRecentReferenceIssue, mergeRecentMetadata, projectRecentMedia, recentMediaScope, resolveCurrentRecentAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-recent-media';
import { getWorkspaceReferenceFields, type WorkspaceReferenceAvailability } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-reference-fields';
import { buildReferenceAssetFromLibraryAsset, getLibraryAssetFieldMismatchMessage, settleReferenceAssetReservation, tryInsertReferenceAsset, type UserAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import type { AssetFieldConfig } from '../frontend/components/Composer';
import type { EngineCaps, EngineInputSchema } from '../frontend/types/engines';
const original = 'https://private.example/source.png?sig=AbC%2F12&token=Exact';
const output: RecentOutput = { id: 'out_1', jobId: 'job_1', url: original, kind: 'image', thumbUrl: 'https://private.example/thumbnail.png?sig=thumb', previewUrl: 'https://private.example/preview.mp4', status: 'ready', mime: 'image/png' };
const entry: AssetFieldConfig = { field: { id: 'start', type: 'image', label: 'Start', maxCount: 1, maxSizeMB: 10 }, required: true };
const asset = (): UserAsset => projectRecentMedia({ ok: true, outputs: [output] }, 'image')[0];
const available: WorkspaceReferenceAvailability = { inputAssets: {}, isUnifiedSeedance: false, isUnifiedKlingO3: false, klingO3VideoToVideoSupported: true, hasAnyVideoInput: false, guestUploadLockedReason: null, workflowCopy: { clearReferencesToUseStartEnd: 'clear refs', clearStartEndToUseReferences: 'clear frames' }, showOmniStudioPanel: false, showLumaRay32KeyframeEditor: false };

test('real recent DTO preserves original kind/identity and becomes eligible only after exact owned metadata', () => {
  const recent = asset();
  assert.equal(recent.url, original); assert.equal(recent.thumbUrl, output.thumbUrl); assert.equal(recent.sourceOutputId, output.id);
  assert.equal(getRecentReferenceIssue(recent, entry, {}, undefined, 'i2v'), 'metadata');
  const resolved = mergeRecentMetadata(recent, 'owner', { id: output.id, userId: 'owner', kind: 'image', url: original, size: 4096, mime: 'image/png' });
  assert.ok(resolved);
  assert.equal(getRecentReferenceIssue(resolved, entry, {}, undefined, 'i2v'), null);
  const input = buildReferenceAssetFromLibraryAsset(entry.field, resolved);
  assert.equal(input.url, original); assert.equal(input.previewUrl, original); assert.equal(input.assetId, output.id);
  assert.equal(input.fieldId, 'start'); assert.equal(input.type, 'image/png');
  for (const patch of [{ id: 'different' }, { userId: 'other' }, { kind: 'audio' }, { url: original + 'x' }, { size: 0 }, { size: NaN }, { mime: 'video/mp4' }]) {
    assert.equal(mergeRecentMetadata(recent, 'owner', { id: output.id, userId: 'owner', kind: 'image', url: original, size: 4096, mime: 'image/png', ...patch }), null);
  }
});

test('recent feed excludes rendering, incompatible kinds, invalid sources and duplicates and caps at 12', () => {
  const outputs = [...Array.from({ length: 20 }, (_, i) => ({ ...output, id: `out_${i}` })), { ...output, id: 'processing', status: 'processing' }, { ...output, id: 'audio', kind: 'audio' as const }, { ...output, id: 'bad', url: 'not-url' }];
  assert.equal(projectRecentMedia({ ok: true, outputs }, 'image').length, 12);
  assert.deepEqual(projectRecentMedia({ ok: true, outputs: [output, output, { ...output, id: 'pending', status: 'processing' }] }, 'image').map(a => a.id), [output.id]);
  assert.deepEqual(projectRecentMedia({ ok: false, outputs }, 'image'), []);
  const [audio] = projectRecentMedia({ ok: true, outputs: [{ ...output, kind: 'audio', mime: 'audio/mpeg' }] }, 'audio');
  assert.equal(audio.kind, 'audio'); assert.ok(getLibraryAssetFieldMismatchMessage({ ...entry.field, type: 'audio' }, asset()));
});

test('account/filter/logout identity rejects old selections even when the same output id is present', () => {
  const key = (userId: string | null, activeKind: 'image' | 'video' = 'image') => buildRecentOutputsKey({ userId, activeKind, activeView: 'review' });
  const scope = recentMediaScope(key('owner'))!;
  const selection = { scope, id: output.id, url: original };
  assert.equal(resolveCurrentRecentAsset(selection, scope, [asset()])?.url, original);
  for (const other of [recentMediaScope(key('other')), recentMediaScope(key('owner', 'video')), recentMediaScope(key(null))]) assert.equal(resolveCurrentRecentAsset(selection, other, [asset()]), null);
  assert.equal(resolveCurrentRecentAsset(selection, scope, [{ ...asset(), url: original + 'new' }]), null);
});

test('roles honor kind, format, duration, size, per-role capacity and shared budget with explicit replacement', () => {
  const image = { ...asset(), size: 2048 };
  const other = { ...image, id: 'other', url: 'https://private.example/other.png' };
  const existing = buildReferenceAssetFromLibraryAsset(entry.field, other);
  assert.equal(getRecentReferenceIssue(image, { ...entry, field: { ...entry.field, type: 'audio' } }, {}, undefined, 'i2v'), 'kind');
  assert.equal(getRecentReferenceIssue({ ...image, mime: 'image/webp' }, { ...entry, field: { ...entry.field, acceptedMimeTypes: ['image/png'] } }, {}, undefined, 'i2v'), 'format');
  assert.equal(getRecentReferenceIssue({ ...image, size: 11 * 1024 * 1024 }, entry, {}, undefined, 'i2v'), 'size');
  const videoEntry: AssetFieldConfig = { field: { id: 'video', type: 'video', label: 'Video', minDurationSec: 2, maxDurationSec: 10 }, required: false };
  const video = { ...image, kind: 'video' as const, mime: 'video/mp4', durationSec: 11 };
  assert.equal(getRecentReferenceIssue(video, videoEntry, {}, undefined, 'v2v'), 'duration');
  assert.equal(getRecentReferenceIssue({ ...video, durationSec: NaN }, videoEntry, {}, undefined, 'v2v'), 'metadata');
  assert.equal(getRecentReferenceIssue({ ...video, durationSec: 5 }, videoEntry, {}, undefined, 'v2v'), null);
  const state = { start: [existing] };
  assert.equal(getRecentReferenceIssue(image, entry, state, undefined, 'i2v'), 'field_limit');
  assert.equal(getRecentReferenceIssue(image, entry, state, undefined, 'i2v', 0), null);
  const second = { ...entry, field: { ...entry.field, id: 'end' } };
  const schema: EngineInputSchema = { required: [entry.field], optional: [second.field], referenceBudget: { fieldIds: ['start', 'end'], maxTotal: 1, countUniqueUrls: true } };
  assert.equal(getRecentReferenceIssue(image, second, state, schema, 'i2v'), 'reference_budget');
  assert.equal(getRecentReferenceIssue(other, second, state, schema, 'i2v'), null);
  const reservation = { ...buildReferenceAssetFromLibraryAsset(entry.field, image), id: 'reservation', status: 'uploading' as const };
  const inserted = tryInsertReferenceAsset(state, entry.field, reservation, 0);
  assert.equal(inserted.accepted, true); if (!inserted.accepted) return;
  const rolledBack = settleReferenceAssetReservation(inserted.state, entry.field, reservation.id, inserted.replacedAsset);
  assert.equal(rolledBack.state.start[0], existing); assert.equal(state.start[0], existing);
  const later = { start: [buildReferenceAssetFromLibraryAsset(entry.field, { ...image, id: 'later' })] };
  assert.equal(settleReferenceAssetReservation(later, entry.field, reservation.id, existing).state, later);
});

test('composer and recents share workflow, auth and specialized-role visibility without changing exact field objects', () => {
  assert.equal(getWorkspaceReferenceFields([entry], available)[0].field, entry.field);
  assert.equal(getWorkspaceReferenceFields([entry], { ...available, guestUploadLockedReason: 'Sign in' })[0].disabled, true);
  assert.equal(getWorkspaceReferenceFields([entry], { ...available, showOmniStudioPanel: true }).length, 0);
  const start = { ...entry, field: { ...entry.field, id: 'image_url' } };
  assert.equal(getWorkspaceReferenceFields([start], { ...available, isUnifiedSeedance: true, inputAssets: { image_urls: [buildReferenceAssetFromLibraryAsset(entry.field, asset())] } })[0].disabledReason, 'clear refs');
  const frame = { ...entry, field: { ...entry.field, id: 'start_image_url' } };
  assert.equal(getWorkspaceReferenceFields([frame], { ...available, showLumaRay32KeyframeEditor: true }).length, 0);
});

test('feed reuses the account-scoped SWR page; insertion and desktop drop stay under existing owners', () => {
  const source = (path: string) => readFileSync(path, 'utf8');
  const feed = source('frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRecentMedia.ts');
  assert.match(feed, /buildRecentOutputsKey/); assert.match(feed, /recentOutputsFetcher/); assert.match(feed, /keepPreviousData: false/); assert.doesNotMatch(feed, /setInterval|refreshInterval|authFetch/);
  const shell = source('frontend/app/(core)/(workspace)/app/_components/WorkspaceAppShell.tsx');
  assert.match(shell, /hidden=\{railView !== 'activity'\}/); assert.match(shell, /<GalleryRail/);
  const adapter = source('frontend/app/(core)/(workspace)/app/_components/WorkspaceRecentReferences.client.tsx');
  assert.match(adapter, /resolveCurrentRecentAsset/); assert.match(adapter, /getData\(RECENT_MEDIA_DRAG_TYPE\)/);
  const ready = source('frontend/app/(core)/(workspace)/app/_components/WorkspaceAppReadyView.tsx');
  assert.match(ready, /onInsert=\{handleSelectLibraryAsset\}/);
  assert.match(ready, /onOpenRecentMedia=\{refreshRecentMedia\}/);
  assert.match(shell, /if \(railView !== 'recent'\) onOpenRecentMedia\?\.\(\)/);
  assert.match(shell, /onClick=\{openRecentMedia\}/);
  assert.match(shell, /onClick=\{\(\) => \{ openRecentMedia\(\); requestAnimationFrame/);
  const modal = source('frontend/components/library/AssetLibraryModal.tsx');
  assert.match(modal, /useAccessibleModal\(\{ onClose: handleClose, closeDisabled: busy \}\)/); assert.match(modal, /aria-labelledby=\{titleId\}/); assert.match(modal, /actionCopy\.loadError/);
});

test('selected media names accept relative sources and never expose signed queries or throw', () => {
  assert.equal(recentMediaFilename('/assets/my%20photo.png', 'Image'), 'my photo.png');
  assert.equal(recentMediaFilename(original, 'Image'), 'source.png');
  assert.equal(recentMediaFilename('https://[broken', 'Image'), 'Image');
  assert.equal(recentMediaFilename('/bad%ZZ.png', 'Image'), 'Image');
  assert.equal(recentMediaFilename('data:image/png;base64,example', 'Image'), 'Image');
});

test('recent eligibility shares engine fallback size and format policy with uploaded references', () => {
  const engine = { inputSchema: { constraints: { maxImageSizeMB: 2, supportedFormats: ['png'] } }, inputLimits: {} } as EngineCaps;
  const noFieldLimit = { ...entry, field: { ...entry.field, maxSizeMB: undefined } };
  assert.equal(getRecentReferenceIssue(asset(), noFieldLimit, {}, engine.inputSchema, 'i2v', undefined, engine), 'metadata');
  assert.equal(getRecentReferenceIssue({ ...asset(), size: 3 * 1024 * 1024 }, noFieldLimit, {}, engine.inputSchema, 'i2v', undefined, engine), 'size');
  assert.equal(getRecentReferenceIssue({ ...asset(), size: 4096 }, noFieldLimit, {}, engine.inputSchema, 'i2v', undefined, engine), null);
  assert.equal(getRecentReferenceIssue({ ...asset(), url: 'https://media.example/image.gif', mime: 'image/gif', size: 4096 }, noFieldLimit, {}, engine.inputSchema, 'i2v', undefined, engine), 'format');
});

test('normal unsaved video and audio DTOs become usable through owned metadata without changing originals', () => {
  for (const [kind, mime, extension] of [['video', 'video/mp4', 'mp4'], ['audio', 'audio/mpeg', 'mp3']] as const) {
    const url = `https://media.example/original.${extension}?signed=Exact%2F`;
    const projected = projectRecentMedia({ ok: true, outputs: [{ ...output, kind, mime, url, durationSec: 5 }] }, kind)[0];
    const field: AssetFieldConfig = { field: { id: kind, label: kind, type: kind, maxCount: 1, maxSizeMB: 20, minDurationSec: 2, maxDurationSec: 10, acceptedMimeTypes: [mime], acceptedFileExtensions: [extension] }, required: true };
    assert.equal(getRecentReferenceIssue(projected, field, {}, undefined, 'v2v'), 'metadata');
    const enriched = mergeRecentMetadata(projected, 'owner', { id: output.id, userId: 'owner', kind, url, size: 100_000, mime });
    assert.ok(enriched);
    assert.equal(getRecentReferenceIssue(enriched, field, {}, undefined, 'v2v'), null);
    assert.equal(buildReferenceAssetFromLibraryAsset(field.field, enriched).url, url);
    assert.equal(enriched.durationSec, 5);
  }
});
