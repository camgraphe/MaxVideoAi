// Explicit localhost fixture installation. Never used by build or application code.
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = suffix => resolve(root, suffix);
const page = path('frontend/app/(core)/(workspace)/app/tools/upscale/page.tsx');
const generated = path('frontend/app/(core)/(workspace)/app/tools/review');
const backup = path('frontend/.toolbox-review/page.original');
const template = await readFile(path('tests/fixtures/toolbox-review/UpscaleReviewPage.tsx'), 'utf8');
if (process.argv.includes('--clean')) {
  if (await readFile(page, 'utf8') !== template) throw new Error('Review page changed; restore manually from frontend/.toolbox-review/page.original.');
  await copyFile(backup, page);
  await rm(generated, { recursive: true, force: true });
  await rm(path('frontend/.toolbox-review'), { recursive: true, force: true });
  await rm(path('frontend/public/toolbox-review'), { recursive: true, force: true });
  console.log('Production route restored.');
} else if (process.argv.includes('--prepare')) {
  const original = await readFile(page, 'utf8');
  if (!original.includes('return <UpscaleWorkspace />;') || original.includes('Fixture')) throw new Error('Unexpected route; refusing to overwrite.');
  await mkdir(path('frontend/.toolbox-review'));
  await writeFile(backup, original, { flag: 'wx' });
  await mkdir(path('frontend/public/toolbox-review'), { recursive: true });
  const video = spawnSync('ffmpeg', ['-v','error','-y','-f','lavfi','-i','testsrc2=size=640x360:rate=24','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',path('frontend/public/toolbox-review/source.mp4')], { stdio: 'inherit' });
  if (video.status !== 0) throw new Error('ffmpeg is required; route has not been changed.');
  await mkdir(generated, { recursive: true });
  await copyFile(path('tests/fixtures/toolbox-review/Fixture.tsx'), resolve(generated, 'Fixture.tsx'));
  await writeFile(page, template);
  console.log('Local dev only: /app/tools/upscale?review=local. Run --clean before committing/building.');
} else throw new Error('Use --prepare or --clean.');
