import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {withOwnedSubtitleSource,type SubtitleSourceDependencies} from '../frontend/src/server/subtitles/source';

test('owned source uses original bytes and measures real metadata, cleans local files and rejects replaced sources',async()=>{
  const bytes=readFileSync('tests/fixtures/studio-media/pattern-a.mp4');let downloads=0,path='';
  const ref={type:'asset' as const,assetId:'owned',kind:'video' as const};
  const dependencies:SubtitleSourceDependencies={
    resolve:async(userId,actual)=>{assert.equal(userId,'owner');assert.deepEqual(actual,ref);return {id:'internal',ref,kind:'video',url:'https://owned.example/original.mp4',mime:'video/mp4',thumbUrl:null,previewUrl:'https://wrong.example/preview.mp4',mediaFacts:null,originalAccess:{type:'owned-storage',storageKey:'user-assets/owner/original.mp4'}};},
    sign:async key=>{assert.equal(key,'user-assets/owner/original.mp4');return 'https://owned.example/original.mp4?signed=private';},
    download:async url=>{downloads++;assert.equal(url,'https://owned.example/original.mp4?signed=private');return bytes;},
  };
  const result=await withOwnedSubtitleSource('owner',ref,async loaded=>{path=loaded.path;assert.ok(existsSync(path));assert.equal(loaded.facts.hasAudio,true);return loaded.source;},{},dependencies);
  assert.equal(result.fingerprint,createHash('sha256').update(bytes).digest('hex'));assert.equal(result.durationMs,6000);assert.equal(existsSync(path),false);
  await assert.rejects(withOwnedSubtitleSource('owner',ref,async()=>null,{expectedFingerprint:'f'.repeat(64)},dependencies),/SOURCE_CHANGED/);
  await assert.rejects(withOwnedSubtitleSource('foreign',ref,async()=>null,{}, {...dependencies,resolve:async()=>{throw new Error('MEDIA_NOT_AVAILABLE');}}),/MEDIA_NOT_AVAILABLE/);
  assert.equal(downloads,2);
});
