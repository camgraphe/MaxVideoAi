import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  shouldUseDirectVideoUpload,
  VERCEL_FUNCTION_BODY_LIMIT_BYTES,
} from '../frontend/lib/client-video-upload.ts';

test('reference videos over the Vercel function payload limit use direct upload', () => {
  const fourPointSixMb = Math.ceil(4.6 * 1024 * 1024);

  assert.equal(VERCEL_FUNCTION_BODY_LIMIT_BYTES, 4.5 * 1024 * 1024);
  assert.equal(shouldUseDirectVideoUpload({ size: fourPointSixMb }), true);
  assert.equal(shouldUseDirectVideoUpload({ size: 1024 * 1024 }), false);
});

test('workspace video reference uploads bypass the Next API body for large files', () => {
  const root = process.cwd();
  const hookSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceReferenceAssets.ts'),
    'utf8'
  );
  const modalSource = fs.readFileSync(path.join(root, 'frontend/components/library/AssetLibraryModal.tsx'), 'utf8');

  assert.match(hookSource, /uploadVideoFile/);
  assert.match(modalSource, /uploadVideoFile/);
  assert.ok(fs.existsSync(path.join(root, 'frontend/app/api/uploads/video/direct/route.ts')));
  assert.ok(fs.existsSync(path.join(root, 'frontend/app/api/uploads/video/complete/route.ts')));
});
