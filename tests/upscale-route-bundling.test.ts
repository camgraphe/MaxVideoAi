import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const legacyRoutePath = 'frontend/app/api/tools/upscale/route.ts';
const imageRoutePath = 'frontend/app/api/tools/upscale/image/route.ts';
const videoRoutePath = 'frontend/app/api/tools/upscale/video/route.ts';
const sharedToolPath = 'frontend/src/server/tools/upscale.ts';
const imageToolPath = 'frontend/src/server/tools/upscale-image.ts';
const videoToolPath = 'frontend/src/server/tools/upscale-video.ts';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

test('upscale API splits image and video routes so heavy native dependencies do not share one bundle', () => {
  assert.ok(existsSync(imageRoutePath), 'image upscale route should exist');
  assert.ok(existsSync(videoRoutePath), 'video upscale route should exist');
  assert.ok(existsSync(imageToolPath), 'image upscale runner should exist');
  assert.ok(existsSync(videoToolPath), 'video upscale runner should exist');

  const legacyRoute = source(legacyRoutePath);
  assert.doesNotMatch(legacyRoute, /server\/tools\/upscale/);
  assert.doesNotMatch(legacyRoute, /run(?:Image|Video)?UpscaleTool/);
  assert.match(legacyRoute, /NextResponse\.redirect/);

  const sharedTool = source(sharedToolPath);
  assert.doesNotMatch(sharedTool, /@\/server\/image-thumbnails/);
  assert.doesNotMatch(sharedTool, /@\/server\/media\/detect-has-audio/);

  const imageTool = source(imageToolPath);
  assert.match(imageTool, /@\/server\/image-thumbnails/);
  assert.doesNotMatch(imageTool, /@\/server\/media\/detect-has-audio/);

  const videoTool = source(videoToolPath);
  assert.match(videoTool, /@\/server\/media\/detect-has-audio/);
  assert.doesNotMatch(videoTool, /@\/server\/image-thumbnails/);
});

test('client posts upscale jobs to the media-specific API route', () => {
  const apiSource = source('frontend/lib/api.ts');

  assert.match(apiSource, /\/api\/tools\/upscale\/\$\{payload\.mediaType\}/);
});

test('Vercel tracing excludes native binaries that cannot run in the deployment runtime', () => {
  const nextConfigSource = source('frontend/next.config.js');

  assert.match(nextConfigSource, /ffprobe-static\/bin\/darwin/);
  assert.match(nextConfigSource, /ffprobe-static\/bin\/win32/);
  assert.match(nextConfigSource, /@img\+sharp-darwin/);
  assert.match(nextConfigSource, /@img\+sharp-win32/);
});
