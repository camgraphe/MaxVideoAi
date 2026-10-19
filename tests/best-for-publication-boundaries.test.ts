import './helpers/server-view-styles';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import publication from '../frontend/config/mcp-publication.json';
import { BestForCreatePaths } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_components/BestForCreatePaths';
import { ExamplesPreview } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_components/BestForExamplesPreview';
import { JSDOM } from 'jsdom';
import { PUBLIC_VIDEO_SOURCE_ELIGIBILITY } from '../frontend/server/videos-query';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const requireFrontend = createRequire(resolve('frontend/package.json'));
const { NextIntlClientProvider } = requireFrontend('next-intl');
const gates = ['publicMarketing', 'publicIndexing', 'transport', 'oauth', 'discovery', 'paidGeneration', 'referenceUploads'] as const;
for (const locale of ['en','fr','es'] as const) {
  test(`${locale}: create paths withdraw MCP discovery while preserving Studio and direct creation`, () => {
    const render = (mcpPublication: typeof publication) => renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale, messages: {}, timeZone: 'UTC'}, React.createElement(BestForCreatePaths, { locale, mcpPublication })));
    const visible = render(publication);
    assert.match(visible, /href="(?:\/fr|\/es)?\/mcp"/);
    for (const gate of gates) {
      const hidden = render({...publication,[gate]:false});
      assert.doesNotMatch(hidden,/href="(?:\/fr|\/es)?\/mcp"/,gate);
      assert.match(hidden,/href="\/app"/);
      assert.match(hidden,/href="(?:\/fr|\/es)?\/studio"/);
    }
  });
}
test('curated scenes use the same source and deletion eligibility as their SEO watch pages', async () => {
  const directory = await mkdtemp(join(tmpdir(),'best-for-publication-'));
  const require = createRequire(import.meta.url);
  const frontendRequire = createRequire(resolve('frontend/package.json'));
  const queries: string[]=[];
  const key='bestForPublicationQueries';
  Object.assign(globalThis,{[key]:queries});
  try {
    const output=join(directory,'previews.cjs');
    const result=await build({stdin:{contents:`export {resolveExamplePreviewPicks} from './frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-previews';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',tsconfig:'frontend/tsconfig.json',packages:'external',define:{'import.meta.url':JSON.stringify(pathToFileURL(resolve('frontend/server/video-keyframes.ts')).href)},plugins:[{name:'db-read-boundary',setup(builder){
      builder.onResolve({filter:/.*/},args=>{
        if(args.path==='@/lib/db')return {path:args.path,namespace:'db-fixture'};
        if(!args.path.startsWith('.')&&!args.path.startsWith('/')&&!args.path.startsWith('@/'))return {path:frontendRequire.resolve(args.path),external:true};
      });
      builder.onLoad({filter:/.*/,namespace:'db-fixture'},()=>({contents:`export const query=async(sql)=>{globalThis.${key}.push(sql);return [];}; export const withDbTransaction=()=>{throw Error('Unexpected write');};`,loader:'ts'}));
    }}]});
    await writeFile(output,result.outputFiles[0].contents);
    const {resolveExamplePreviewPicks}=require(output);
    assert.deepEqual(await resolveExamplePreviewPicks([{slug:'flux-3',engine:{engineId:'flux-3'}}],'en','image-to-video'),[]);
    assert.equal(queries.length,1);
    assert.ok(queries[0].includes(PUBLIC_VIDEO_SOURCE_ELIGIBILITY),'the final media read must enforce the existing deletion and playable-source gate');
    assert.match(queries[0],/visibility = 'public'/);
  } finally { delete (globalThis as Record<string, unknown>)[key]; await rm(directory,{recursive:true,force:true}); }
});


test('scene gallery prioritizes exactly its first rendered poster and never an idle video', () => {
  const picks = [0,1,2].map(index => ({ slug: 'flux-3', example: {id:'public-scene-'+index, title:'Scene '+index, poster:'/poster-'+index+'.jpg',videoUrl:'https://media.maxvideoai.com/scene-'+index+'.mp4',duration:5,watchFor:'Movement'} }));
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages:{},timeZone:'UTC'},React.createElement(ExamplesPreview,{locale:'en',picks:picks as any})));
  const dom=new JSDOM(html);
  const images=[...dom.window.document.querySelectorAll('img')];
  assert.equal(images.length,3);
  assert.deepEqual(images.map(image=>image.getAttribute('fetchpriority')),['high',null,null]);
  assert.deepEqual(images.map(image=>image.getAttribute('loading')),[null,'lazy','lazy']);
  assert.equal(dom.window.document.querySelectorAll('video').length,0);
  dom.window.close();
});
