import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('workspace video rail opens renders in the composite preview, not the group viewer', () => {
  const railSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/GalleryRail.tsx'),
    'utf8'
  );
  const cardSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/components/GroupedJobCard.tsx'),
    'utf8'
  );

  assert.match(cardSource, /showOpenOverlay\?:\s*boolean/);
  assert.match(cardSource, /showOpenOverlay\s*&&\s*onOpen/);
  assert.match(cardSource, /onClick=\{\(\)\s*=>\s*handleAction\('open'\)\}/);
  assert.doesNotMatch(cardSource, /showGalleryActions[\s\S]*onClick=\{\(\)\s*=>\s*handleAction\('view'\)\}/);

  assert.match(railSource, /openLabel=\{feedType === 'video' \? 'Preview' : undefined\}/);
  assert.match(railSource, /showOpenOverlay=\{false\}/);
});

test('Seedance completion persists canonical video outputs before preview enrichment', () => {
  const pollSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/byteplus-poll.ts'),
    'utf8'
  );

  assert.match(pollSource, /upsertLegacyJobOutputs/);
  assert.match(pollSource, /video_url:\s*copiedVideoUrl/);
  assert.match(pollSource, /thumb_url:\s*thumb/);
  assert.match(pollSource, /generateAndPersistJobPreviewVideo/);
});

test('composite preview modal button opens direct preview groups', () => {
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/AppClient.tsx'),
    'utf8'
  );

  assert.match(appSource, /\|\s*\{\s*kind:\s*'group';\s*group:\s*VideoGroup\s*\}/);
  assert.match(appSource, /if\s*\(viewerTarget\.kind === 'group'\)\s*\{\s*return viewerTarget\.group;\s*\}/);
  assert.match(appSource, /setViewerTarget\(\{\s*kind:\s*'group',\s*group\s*\}\)/);
});
