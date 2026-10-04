import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm,mkdir,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {bundle} from '@remotion/bundler';
import {renderMedia,selectComposition} from '@remotion/renderer';
import {chromium} from '@playwright/test';
import {buildStudioMontageProjectState} from '../frontend/src/server/studio/montage-command';
import {applyConversationTimelineEdit} from '../frontend/lib/studio/conversation-timeline-editing';
import {buildWorkspaceTimelineRenderManifest} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';
import {parseTimelineExportManifest} from '../frontend/src/server/timeline-exports/render-request';
import {studioMediaByteResponse} from './helpers/studio-media-byte-fixture';
const run = promisify(execFile);

test('the production composition renders the same native cut, length and embedded sound into a real MP4', {timeout: 180000},async () => {
  const browserExecutable = chromium.executablePath();
  // Remotion starts its HTTP server alongside Chromium; a missing executable
  // rejects before its server cleanup is installed. Fail before allocating either.
  assert.ok(existsSync(browserExecutable),'An installed Playwright Chromium is required; run pnpm exec playwright install chromium before this real render test.');
  const temporary = await mkdtemp(join(tmpdir(),'studio-native-render-'));
  const bytes = new Map(await Promise.all(['a','b'].map(async letter => [`/pattern-${letter}.mp4`,await readFile(resolve(`tests/fixtures/studio-media/pattern-${letter}.mp4`))] as const)));
  // Exact local test bytes, no arbitrary URL or provider. Ownership/security gateways have separate PG/HTTP suites.
  const server = createServer((req,res) => {const media = bytes.get(req.url ?? '');if (!media) {res.writeHead(404).end();return;}const response = studioMediaByteResponse(media,{method: req.method ?? 'GET',range: req.headers.range ?? null});res.writeHead(response.status,response.headers).end(response.body);});
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  const address = server.address();assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const input = {title: 'Native cut proof',idempotencyKey: 'native-cut-proof',settings: {fps: 30 as const,aspectRatio: '16:9' as const,resolution: '720p' as const,audioMode: 'preserve' as const},clips: [{assetId: 'ma_'+'1'.repeat(32),sourceInFrame: 30,durationFrames: 60},{assetId: 'ma_'+'2'.repeat(32),sourceInFrame: 15,durationFrames: 60}]};
    const assets = ['b','a'].map((letter,index) => ({id: 'asset-'+index,ref: {type: 'asset' as const,assetId: input.clips[index].assetId,kind: 'video' as const},kind: 'video' as const,url: `${origin}/pattern-${letter}.mp4`,thumbUrl: null,previewUrl: null,mime: 'video/mp4',originalAccess: {type: 'external' as const},mediaFacts: {source: 'probe' as const,durationSec: 6,width: 320,height: 180,hasAudio: true}}));
    const state = buildStudioMontageProjectState({input,assets,projectId: 'proof',sequenceId: 'main'});
    const items = applyConversationTimelineEdit(state.sequence.timelineItems,{kind: 'trim',clipId: 'montage-clip-01',edge: 'start',durationFrames: 30},30,[]);
    const manifest = parseTimelineExportManifest(buildWorkspaceTimelineRenderManifest({items,nodes: [],projectName: input.title,sequenceId: 'main',sequenceName: state.sequence.name,projectSettings: state.sequence.projectSettings}));
    assert.equal(manifest.durationSec,3);
    assert.deepEqual(manifest.tracks[0].clips.map(clip => [clip.sourceStartSec,clip.sourceEndSec,clip.durationSec]),[[2,3,1],[.5,2.5,2]]);
    const renderer = await import('../frontend/src/server/timeline-exports/renderer');
    const entry = 'timelineExportEntryPoint' in renderer ? renderer.timelineExportEntryPoint() : resolve('frontend/src/remotion/timeline-export/Root.tsx');
    const publicDir = join(temporary,'public');await mkdir(publicDir);
    const serveUrl = await bundle({entryPoint: entry,publicDir});
    const inputProps = {manifest,width: 1280,height: 720,fps: 30,includeAudio: true,mediaTrust: 'server-validated' as const};
    const composition = await selectComposition({serveUrl,id: 'MaxVideoAITimelineExport',inputProps,browserExecutable});
    const output = join(temporary,'native-cut-3s.mp4');
    await renderMedia({serveUrl,composition,inputProps,codec: 'h264',outputLocation: output,browserExecutable,concurrency: 2,chromiumOptions: {gl: 'angle'},...renderer.TIMELINE_EXPORT_COLOR_SETTINGS});
    if (process.env.STUDIO_PROOF_DIRECTORY) {await mkdir(process.env.STUDIO_PROOF_DIRECTORY,{recursive: true});await copyFile(output,join(process.env.STUDIO_PROOF_DIRECTORY,'native-cut-3s-diagnostic.mp4'));}
    const probe = JSON.parse((await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output])).stdout);
    const video = probe.streams.find((stream: any) => stream.codec_type === 'video');
    assert.equal(video.width,1280);assert.equal(video.height,720);assert.equal(Number(video.nb_frames),90);
    assert.ok(Math.abs(Number(probe.format.duration)-3)<.06);
    assert.ok(probe.streams.some((stream: any) => stream.codec_type === 'audio' && stream.codec_name === 'aac'));
    for (const [outputTime,sourceTime,letter] of [[0,2,'b'],[1,.5,'a']] as const) {
      // Decode exactly one frame on each side: comparing a moving stream to a still would
      // average buffered future frames. Normalize both to RGB before evaluating fidelity.
      const actual = join(temporary,`actual-${letter}.png`);const reference = join(temporary,`reference-${letter}.png`);
      await run('ffmpeg',['-v','error','-ss',String(outputTime),'-i',output,'-frames:v','1',actual]);
      await run('ffmpeg',['-v','error','-ss',String(sourceTime),'-i',resolve(`tests/fixtures/studio-media/pattern-${letter}.mp4`),'-vf','format=rgb24,scale=1280:720:flags=bilinear','-frames:v','1',reference]);
      const comparison = await run('ffmpeg',['-i',actual,'-i',reference,'-filter_complex','[0:v]format=gbrp[render];[1:v]format=gbrp[reference];[render][reference]ssim','-frames:v','1','-f','null','-']);
      const score = Number(comparison.stderr.match(/All:([\d.]+)/)?.[1]);
      // Saturated 4:2:0 stress patterns measure .967/.942 after H.264 and chroma resampling.
      // Their adjacent source frames measure at most .905: the floor and both negative
      // controls qualify the precise cut without pretending the encoded MP4 is lossless.
      assert.ok(score>.93,`Exported frame at ${outputTime}s must match pattern-${letter} at ${sourceTime}s, SSIM=${score}`);
      for (const offset of [-1,1]) {
        const wrongFrame = join(temporary,`offset-${letter}-${offset}.png`);
        await run('ffmpeg',['-v','error','-ss',String(sourceTime+offset/30),'-i',resolve(`tests/fixtures/studio-media/pattern-${letter}.mp4`),'-vf','format=rgb24,scale=1280:720:flags=bilinear','-frames:v','1',wrongFrame]);
        const wrong = await run('ffmpeg',['-i',actual,'-i',wrongFrame,'-filter_complex','[0:v]format=gbrp[render];[1:v]format=gbrp[reference];[render][reference]ssim','-frames:v','1','-f','null','-']);
        assert.ok(score > Number(wrong.stderr.match(/All:([\d.]+)/)?.[1])+.04,'The exact source frame must clearly beat either adjacent frame.');
      }
    }
    for (const [time,frequency] of [[.2,880],[1.2,440]]) {
      const audio = (await run('ffmpeg',['-v','error','-ss',String(time),'-i',output,'-t','0.4','-vn','-ac','1','-ar','48000','-f','f32le','pipe:1'],{encoding: 'buffer'})).stdout;
      let crossings = 0;let power = 0;let previous = audio.readFloatLE(0);
      for (let offset = 4;offset < audio.length;offset += 4) {const sample = audio.readFloatLE(offset);if ((sample >= 0) !== (previous >= 0)) crossings++;power += sample*sample;previous = sample;}
      assert.ok(Math.sqrt(power/(audio.length/4))>.01,'The rendered sound must be audible, not an empty AAC track.');
      assert.ok(Math.abs(crossings/(2*(audio.length/4/48000))-frequency)<20,'Each cut preserves its own embedded tone.');
    }
    if (process.env.STUDIO_PROOF_DIRECTORY) {await mkdir(process.env.STUDIO_PROOF_DIRECTORY,{recursive: true});await copyFile(output,join(process.env.STUDIO_PROOF_DIRECTORY,'native-cut-3s.mp4'));await rm(join(process.env.STUDIO_PROOF_DIRECTORY,'native-cut-3s-diagnostic.mp4'),{force: true});}
  } finally {await new Promise<void>(resolve => server.close(() => resolve()));await rm(temporary,{recursive: true,force: true});}
});
