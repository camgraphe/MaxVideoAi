import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {existsSync,mkdtempSync,readFileSync,rmSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {bundle} from '@remotion/bundler';
import {makeCancelSignal,renderMedia,selectComposition} from '@remotion/renderer';
import {buildWorkspaceTimelineRenderManifest} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';
import type {WorkspaceTimelineItem} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import type {TimelineExportRenderProps} from '../frontend/src/remotion/timeline-export/types';

// Explicit opt-in: a real local Chromium/FFmpeg render, never a provider or worker dispatch.
test('real local render uses GET-only grants and preserves video trim and simultaneous audio source trims, gain and mute',{
  skip: process.env.STUDIO_MULTITRACK_RENDER_TEST !== '1',timeout: 300_000,
},async t => {
  const began = Date.now();
  const proofDir = process.env.STUDIO_MULTITRACK_RENDER_PROOF_DIR;
  const dir = proofDir ? resolve(proofDir) : mkdtempSync(join(tmpdir(),'studio-multitrack-render-'));
  mkdirSync(dir,{recursive: true});
  t.after(() => {if (!proofDir) rmSync(dir,{recursive: true,force: true});});
  const cache = join(homedir(),'Library/Caches/ms-playwright');
  const browserExecutable = process.env.STUDIO_RENDER_BROWSER_EXECUTABLE ?? readdirSync(cache)
    .filter(name => name.startsWith('chromium_headless_shell-')).sort().reverse()
    .map(name => join(cache,name,'chrome-headless-shell-mac-arm64/chrome-headless-shell')).find(existsSync);
  assert.ok(browserExecutable,'An already installed browser is required; this test never downloads one.');
  const ffmpeg = (args: string[]) => execFileSync('ffmpeg',['-hide_banner','-loglevel','error',...args],{timeout: 20_000,maxBuffer: 16*1024*1024});
  for (const [name,first,trimmed] of [['voice',220,440],['music',660,880]] as const) {
    ffmpeg(['-n','-f','lavfi','-i',`sine=frequency=${first}:sample_rate=48000:duration=1`,'-f','lavfi','-i',`sine=frequency=${trimmed}:sample_rate=48000:duration=4`,'-filter_complex','[0:a][1:a]concat=n=2:v=0:a=1[out]','-map','[out]','-c:a','pcm_s16le',join(dir,name+'.wav')]);
  }
  const files: Record<string,Buffer> = {
    '/pattern.mp4': readFileSync('tests/fixtures/studio-media/pattern-a.mp4'),
    '/voice.wav': readFileSync(join(dir,'voice.wav')),
    '/music.wav': readFileSync(join(dir,'music.wav')),
  };
  const requests: {method: string;path: string;allowed: boolean}[] = [];
  const server = createServer((req,res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const allowed = req.method === 'GET' && url.searchParams.get('method') === 'GET';
    requests.push({method: req.method ?? '',path: url.pathname,allowed});
    if (!allowed) {res.writeHead(403);res.end();return;}
    const data = files[url.pathname];
    if (!data) {res.writeHead(404);res.end();return;}
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Math.min(Number(range[2]),data.length-1) : data.length-1;
    res.writeHead(range ? 206 : 200,{'Content-Type': url.pathname.endsWith('.wav') ? 'audio/wav' : 'video/mp4','Accept-Ranges': 'bytes','Content-Length': end-start+1,...range ? {'Content-Range': `bytes ${start}-${end}/${data.length}`} : {}});
    res.end(data.subarray(start,end+1));
  });
  await new Promise<void>(done => server.listen(0,'127.0.0.1',done));
  t.after(() => new Promise<void>((done,reject) => {server.close(error => error ? reject(error) : done());server.closeAllConnections();}));
  const base = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
  assert.equal((await fetch(base+'/pattern.mp4?method=GET',{method: 'HEAD'})).status,403);
  assert.equal((await fetch(base+'/pattern.mp4')).status,403);
  requests.length=0;
  const items: WorkspaceTimelineItem[] = [
    {id: 'visual',outputNodeId: 'visual',title: 'Measured test pattern',track: 'video',mediaKind: 'video',mediaUrl: base+'/pattern.mp4',startSec: 0,durationSec: 3,sourceStartSec: 1,sourceDurationSec: 6,mediaFacts: {source: 'probe',durationSec: 6,width: 320,height: 180,hasAudio: true},hasEmbeddedAudio: true,audioProvenance: 'embedded',audioMix: {volume: 100,muted: true},status: 'completed'},
    {id: 'voice',outputNodeId: 'voice',title: 'Synthetic voice marker',track: 'audio',mediaKind: 'audio',mediaUrl: base+'/voice.wav',startSec: 0,durationSec: 3,sourceStartSec: 1,sourceDurationSec: 5,audioProvenance: 'external',audioMix: {volume: 80,muted: false},status: 'completed'},
    {id: 'music',outputNodeId: 'music',title: 'Synthetic music marker',track: 'audio-2',mediaKind: 'audio',mediaUrl: base+'/music.wav',startSec: .5,durationSec: 2,sourceStartSec: 1,sourceDurationSec: 5,audioProvenance: 'external',audioMix: {volume: 25,muted: false},status: 'completed'},
  ];
  const serveUrl = await bundle({entryPoint: resolve('frontend/src/remotion/timeline-export/index.ts'),outDir: join(dir,'bundle')});
  const report: Record<string,unknown> = {fixtureOnly: true,providerCalls: 0,composition: 'MaxVideoAITimelineExport',width: 320,height: 180,fps: 30};
  for (const muted of [false,true]) {
    const manifest = buildWorkspaceTimelineRenderManifest({items: items.map(item => item.id === 'music' ? {...item,audioMix: {volume: 25,muted}} : item),nodes: [],projectName: 'Synthetic multitrack fixture',sequenceId: 'main',sequenceName: 'Main'});
    assert.equal(manifest.status,'ready');
    // Mimic the worker's temporary GET-grant copy without changing the canonical fixture manifest.
    const transport = {...manifest,tracks: manifest.tracks.map(track => ({...track,clips: track.clips.map(clip => ({...clip,mediaUrl: clip.mediaUrl+'?method=GET'}))}))};
    const inputProps: TimelineExportRenderProps = {manifest: transport,width: 320,height: 180,fps: 30,includeAudio: true,mediaTrust: 'server-validated'};
    const composition = await selectComposition({serveUrl,id: 'MaxVideoAITimelineExport',inputProps,browserExecutable});
    assert.equal(composition.durationInFrames,90);
    const output = join(dir,muted ? 'music-muted.mp4' : 'voice-and-music.mp4');
    const {cancel,cancelSignal} = makeCancelSignal();
    const timer = setTimeout(cancel,Math.max(1,240_000-(Date.now()-began)));
    try {await renderMedia({composition,serveUrl,inputProps,outputLocation: output,browserExecutable,codec: 'h264',imageFormat: 'png',colorSpace: 'bt709',concurrency: 1,offthreadVideoThreads: 1,timeoutInMilliseconds: 30_000,cancelSignal});}
    finally {clearTimeout(timer);}
    const probe = JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output],{encoding: 'utf8',timeout: 10_000}));
    const video = probe.streams.find((stream: {codec_type: string}) => stream.codec_type === 'video');
    const audio = probe.streams.find((stream: {codec_type: string}) => stream.codec_type === 'audio');
    assert.deepEqual([video.width,video.height,video.r_frame_rate,Number(video.nb_frames)],[320,180,'30/1',90]);
    assert.equal(Number(video.duration),3,'The visual edit ends at exactly frame 90.');
    // AAC uses complete 1024-sample packets; report and bound its container tail separately.
    const maxAacPaddingSec=3*1024/Number(audio.sample_rate);
    assert.ok(Number(probe.format.duration)>=3 && Number(probe.format.duration)<=3+maxAacPaddingSec);
    const pcm = ffmpeg(['-i',output,'-vn','-ac','1','-ar','48000','-f','f32le','pipe:1']);
    const amplitude = (frequency: number,start: number,end: number) => {
      let re=0,im=0;
      const from=Math.round(start*48000),to=Math.round(end*48000);
      for(let sample=from;sample<to;sample++){const value=pcm.readFloatLE(sample*4);const phase=2*Math.PI*frequency*sample/48000;re+=value*Math.cos(phase);im+=value*Math.sin(phase);}
      return 2*Math.hypot(re,im)/(to-from);
    };
    const voice = amplitude(440,.8,1.2),music = amplitude(880,.8,1.2),ratio=music/voice;
    assert.ok(voice>.08 && voice<.12,'Voice gain is 80%, with no doubled embedded video sound.');
    assert.ok(amplitude(220,.8,1.2)<voice*.02 && amplitude(660,.8,1.2)<voice*.02,'Both source start trims remove the first-second tones.');
    assert.ok(amplitude(880,.1,.4)<voice*.02 && amplitude(880,2.6,2.9)<voice*.02,'Music plays only between timeline seconds 0.5 and 2.5.');
    if(muted) assert.ok(ratio<.02,'Muted music is absent from the rendered mix.');
    else assert.ok(ratio>.27 && ratio<.36,`25% music / 80% voice should be about 0.3125; measured ${ratio}`);
    report[muted ? 'muted' : 'mixed']={path: output,durationSec: Number(probe.format.duration),videoDurationSec: Number(video.duration),aacPaddingSec: Number(probe.format.duration)-3,maxAacPaddingSec,frames: Number(video.nb_frames),voiceAmplitude: voice,musicAmplitude: music,musicVoiceRatio: ratio};
    assert.ok(manifest.tracks.flatMap(track => track.clips).every(clip => !clip.mediaUrl.includes('?')),'Transport grants never mutate the canonical manifest.');
  }
  assert.ok(requests.length>0,'The real renderer fetched media from the grant-restricted server.');
  assert.deepEqual(requests.filter(request => !request.allowed),[],'The real renderer never attempts HEAD or an unsigned media URL.');
  assert.deepEqual([...new Set(requests.map(request => request.path))].sort(),Object.keys(files).sort());
  report.transport={getOnly: true,requests: requests.length,headRequests: requests.filter(request => request.method === 'HEAD').length,rejectedRequests: requests.filter(request => !request.allowed).length};
  const frame = (file: string,index: number) => ffmpeg(['-i',file,'-vf',`select=eq(n\\,${index})`,'-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']);
  const rendered = frame(join(dir,'voice-and-music.mp4'),0);
  const expected = frame('tests/fixtures/studio-media/pattern-a.mp4',30);
  const untrimmed = frame('tests/fixtures/studio-media/pattern-a.mp4',0);
  const rmse = (left: Buffer,right: Buffer) => Math.sqrt(left.reduce((sum,value,index) => sum+(value-right[index])**2,0)/left.length);
  const correctRmse=rmse(rendered,expected),wrongRmse=rmse(rendered,untrimmed);
  assert.ok(correctRmse<wrongRmse*.65,`Video begins at its trimmed source second: RMSE ${correctRmse} vs untrimmed ${wrongRmse}.`);
  report.videoTrim={correctRmse,wrongRmse};report.elapsedMs=Date.now()-began;
  writeFileSync(join(dir,'qualification.json'),JSON.stringify(report,null,2));
  t.diagnostic(JSON.stringify(report));
});
