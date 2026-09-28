import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const read=(path:string)=>readFileSync(path,'utf8');
test('direct watch pages and gallery use the same reader without replacing canonical or schema ownership',()=>{
 const watch=read('frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx');
 const modal=read('frontend/components/examples/ExampleReader.client.tsx');
 const shared=read('frontend/components/examples/ExampleReaderContent.tsx');
 const route=read('frontend/app/(core)/video/[id]/page.tsx');
 assert.match(watch,/ExampleReaderContent/);assert.match(modal,/ExampleReaderContent/);
 assert.match(watch,/headingLevel="h1"/);assert.match(shared,/headingLevel/);
 assert.match(watch,/contentUrl: videoUrl/);assert.match(watch,/type="application\/ld\+json"/);
 assert.match(route,/getVideoCanonicalRedirectPath/);assert.match(route,/robots: \{ index: isEligible/);
 assert.doesNotMatch(watch,/WatchVideoPlayer|VideoWatchSidebar/,'the old competing presentation is removed');
 const nav=read('frontend/components/examples/useGalleryReader.ts');
 assert.doesNotMatch(nav,/url\.hash\s*=/,'opening a video uses its existing watch URL');
 assert.match(shared,/detail\.context/,'editorial context remains available in the shared view');
});
