import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = (file:string) => readFileSync(`frontend/${file}`,'utf8');
test('app demonstration cards reuse public attempt policy and never mount video while idle',()=>{
 const card=read('components/media/AppDemoCardMedia.client.tsx');
 assert.match(card,/useExampleCardPlayback/);
 assert.match(card,/requested && visible/);
 assert.match(card,/IntersectionObserver/);
 assert.match(card,/playbackAttempt \? <video/);
 assert.match(card,/preload="none"/);
 assert.match(card,/preview\?\.previewVideoUrl \?\? preview\?\.videoUrl/);
 assert.match(read('components/GroupedJobCardPreviewGrid.tsx'),/group.hero.job\?\.curated/);
 assert.doesNotMatch(card,/shouldWarm|preload="auto"|fetch\(/);
});
test('selected app demos use prepared display derivatives with original fallback through the shared lifecycle',()=>{
 const video=read('components/media/AppDemoVideo.client.tsx');
 assert.match(video,/usePublicVideoPlayback\('workspace-preview'\)/);
 assert.match(video,/fail\(attempt.id/);
 assert.match(video,/src=\{attempt.rendition.src\}/);
 const dock=read('components/groups/CompositePreviewDockTile.tsx');
 assert.match(dock,/shouldPlayVideo && item.meta\?\.curated === true/);
 assert.match(dock,/\) : shouldPlayVideo \? \(/);
 assert.match(read('lib/video-group-adapter.ts'),/member.job\?\.curated/);
});
