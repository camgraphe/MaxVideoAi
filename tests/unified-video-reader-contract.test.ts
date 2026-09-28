import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExampleReaderStyles } from '../frontend/components/examples/example-reader-styles';
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

test('reader styles stay local to both reader shells without adding a blocking stylesheet', () => {
 const folder = 'frontend/components/examples/';
 const watch = read('frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx');
 const watchLayout = read('frontend/app/(core)/video/layout.tsx');
 const modal = read(`${folder}ExampleReader.client.tsx`);
 assert.match(watchLayout, /<ExampleReaderStyles\s*\/>/);
 assert.ok(watchLayout.indexOf('<ExampleReaderStyles') < watchLayout.indexOf('<MarketingVideoLayout'),
   'emit styles before the existing marketing shell waits for its auth snapshot');
 assert.match(watchLayout, /<MarketingVideoLayout>\{children\}<\/MarketingVideoLayout>/);
 assert.doesNotMatch(watchLayout, /\basync\b|\bawait\b/, 'reader CSS must be available before watch data resolves');
 assert.doesNotMatch(watch, /<ExampleReaderStyles/, 'emit the stylesheet once in the earlier route shell');
 assert.match(modal, /<ExampleReaderStyles\s*\/>/);
 assert.ok(modal.indexOf('<ExampleReaderStyles') < modal.indexOf('{current?.detail ?'), 'loading and error states need the same styles');
 for (const source of [watch, ...['ExampleReader.client.tsx', 'ExampleReaderContent.tsx', 'ExampleReaderContext.tsx', 'DiscoveryVideoPlayer.client.tsx'].map(file => read(folder + file))]) {
  assert.doesNotMatch(source, /example-reader\.module\.css/, 'a remaining CSS import reintroduces the extra blocking request');
 }
 const gallery = read(`${folder}ExamplesGalleryGrid.client.tsx`);
 assert.doesNotMatch(gallery, /example-reader-styles/, 'the initial gallery must not load reader styles');
});

test('server-rendered reader styles preserve CSS combinators without HTML escaping', () => {
 const html = renderToStaticMarkup(React.createElement(ExampleReaderStyles));
 assert.equal((html.match(/<style/g) ?? []).length, 1);
 assert.match(html, /\.video-reader-references>div/);
 assert.doesNotMatch(html, /&gt;|&lt;|:global\(/, 'SSR must emit valid scoped CSS before hydration');
});
