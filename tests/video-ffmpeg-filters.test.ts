import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('video enrichment ffmpeg filters avoid scale options missing from deployed linux binary', () => {
  const previewSource = fs.readFileSync(path.join(process.cwd(), 'frontend/server/video-preview.ts'), 'utf8');
  const keyframesSource = fs.readFileSync(path.join(process.cwd(), 'frontend/server/video-keyframes.ts'), 'utf8');

  for (const [label, source] of [
    ['preview', previewSource],
    ['keyframes', keyframesSource],
  ] as const) {
    assert.doesNotMatch(source, /force_divisible_by/, `${label} filter should not require force_divisible_by`);
    assert.match(
      source,
      /trunc\(iw\/2\)\*2:trunc\(ih\/2\)\*2/,
      `${label} filter should still force even output dimensions`
    );
  }
});
