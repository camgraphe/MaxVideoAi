import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  createStudioMontageClipDraft,
  retimeStudioMontageClips,
  studioMontageBusinessPayload,
  studioMontageLibraryAsset,
  validateStudioMontageDraft,
} from '../frontend/app/(core)/(workspace)/app/studio/projects/studio-montage-builder';

const assetId = `ma_${'a'.repeat(32)}`;
const asset = { assetId, durationSec: 2.5, name: 'Measured', thumbnailUrl: null };
const settings = { fps: 24 as const, aspectRatio: '16:9' as const, resolution: '1080p' as const, audioMode: 'preserve' as const };

test('the montage picker qualifies only canonical videos with measured probe duration', () => {
  const eligible = studioMontageLibraryAsset({
    id: 'internal', name: 'A', meta: 'Video', kind: 'video', ref: { type: 'asset', assetId, kind: 'video' },
    mediaFacts: { source: 'probe', durationSec: 2.5 }, url: 'https://private.invalid/a.mp4',
  });
  assert.deepEqual(eligible, { ...asset, name: 'A' });
  for (const candidate of [
    { id: 'a', name: 'A', meta: '', kind: 'video', ref: { type: 'asset', assetId, kind: 'video' }, durationSec: 2.5 },
    { id: 'b', name: 'B', meta: '', kind: 'video', ref: { type: 'asset', assetId, kind: 'video' }, mediaFacts: { source: 'historical', durationSec: 2.5 } },
    { id: 'c', name: 'C', meta: '', kind: 'video', ref: { type: 'job-output', jobId: 'job', outputId: 'out', kind: 'video' }, mediaFacts: { source: 'probe', durationSec: 2.5 } },
  ]) assert.equal(studioMontageLibraryAsset(candidate as never), null);
});

test('clip drafts keep order and exact frame trims while fps changes preserve edit time', () => {
  const first = createStudioMontageClipDraft({ asset, fps: 24, occurrenceId: 'one' });
  const second = { ...first, occurrenceId: 'two', sourceInFrame: 12, durationFrames: 24 };
  assert.deepEqual(retimeStudioMontageClips([second], 24, 60)[0], {
    ...second, sourceInFrame: 30, durationFrames: 60,
  });
  assert.deepEqual(retimeStudioMontageClips([{
    ...first, measuredDurationSec: 1, sourceInFrame: 12, durationFrames: 12,
  }], 24, 25)[0], {
    ...first, measuredDurationSec: 1, sourceInFrame: 13, durationFrames: 12,
  });
  assert.deepEqual(studioMontageBusinessPayload({ title: 'Cut', settings, clips: [first, second] }).clips, [
    { assetId, sourceInFrame: 0, durationFrames: 60 },
    { assetId, sourceInFrame: 12, durationFrames: 24 },
  ]);
});

test('draft validation rejects missing occurrences, out-of-source trims and totals over 180 seconds', () => {
  const clip = createStudioMontageClipDraft({ asset, fps: 24, occurrenceId: 'one' });
  assert.equal(validateStudioMontageDraft({ title: 'Cut', settings, clips: [clip] }), 'count');
  assert.equal(validateStudioMontageDraft({ title: 'Cut', settings, clips: [clip, { ...clip, occurrenceId: 'two', durationFrames: 61 }] }), 'trim');
  const long = { ...clip, measuredDurationSec: 200, durationFrames: 2_400 };
  assert.equal(validateStudioMontageDraft({ title: 'Cut', settings, clips: [long, { ...long, occurrenceId: 'two' }] }), 'duration');
});

test('the projects route hides the creator behind the exact server gate and the dialog owns accessible focus', () => {
  const route = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/projects/page.tsx'), 'utf8');
  const client = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/projects/StudioMontageBuilder.client.tsx'), 'utf8');
  assert.match(route, /isStudioMontageCreationEnabled\([\s\S]*requestHeaders\.get\('host'\)/);
  assert.match(route, /montageCreationEnabled=\{montageCreationEnabled\}/);
  assert.match(client, /if \(!enabled\) return null/);
  assert.match(client, /useAccessibleModal<HTMLFormElement>/);
  assert.match(client, /closeDisabled: submitting/);
  assert.match(client, /<fieldset className=\{styles\.montageFields\} disabled=\{submitting\}>/);
  assert.match(client, /controller\.abort\(\), STUDIO_MONTAGE_CREATE_TIMEOUT_MS/);
  assert.match(client, /data-modal-initial-focus="true"/);
  assert.match(client, /data-studio-montage-move-up=\{index\}/);
  assert.match(client, /data-studio-montage-move-down=\{index\}/);
  assert.match(client, /data-studio-montage-remove=\{index\}/);
  assert.match(client, /data-studio-montage-library-error="true"/);
  assert.match(client, /data-studio-montage-library-retry="true"/);
  assert.match(client, /setLoadAttempt\(\(attempt\) => attempt \+ 1\)[\s\S]*dialogRef\.current\?\.focus\(\)/);
  assert.match(client, /\{validationCopy \?[\s\S]*data-studio-montage-validation-error="true"/);
  assert.match(client, /\{loadError \?[\s\S]*data-studio-montage-library-error="true"/);
});
