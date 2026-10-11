import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('completed chat exports offer a localized stable MP4 download without changing the preview or exposing unfinished artifacts',async () => {
  const frontend=resolve('frontend');
  const result=await build({absWorkingDir:frontend,
    stdin:{contents:"export {ConversationRenderCards} from './app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ConversationRenderCards.client';",resolveDir:frontend,loader:'tsx'},
    tsconfig:resolve(frontend,'tsconfig.json'),bundle:true,platform:'node',format:'cjs',write:false,packages:'external',jsx:'automatic',
    plugins:[{name:'css-fixture',setup(builder){
      builder.onResolve({filter:/\.module\.css$/},args=>({path:args.path,namespace:'css-fixture'}));
      builder.onLoad({filter:/.*/,namespace:'css-fixture'},()=>({contents:'export default {};',loader:'js'}));
    }}],
  });
  const module={exports:{} as any};
  runInNewContext(result.outputFiles[0].text,{module,exports:module.exports,require:createRequire(resolve(frontend,'package.json'))});
  const artifact={outputUrl:'/api/studio/timeline-exports/export-ready/media',outputAssetId:null,sizeBytes:128,mimeType:'video/mp4'};
  const jobs=[
    {id:'export-ready',status:'completed',progress:100,message:null,artifact},
    {id:'export-working',status:'rendering',progress:35,message:null,artifact},
    {id:'export-failed',status:'failed',progress:0,message:null,artifact:null},
  ];
  for(const [locale,label] of [['en','Download MP4'],['fr','Télécharger le MP4']] as const){
    const dom=new JSDOM(renderToStaticMarkup(createElement(module.exports.ConversationRenderCards,{jobs,locale})));
    const links=[...dom.window.document.querySelectorAll('a')].filter(link=>link.textContent===label);
    assert.equal(links.length,1,'Only a completed job may expose a download.');
    assert.equal(links[0].getAttribute('href'),'/api/studio/timeline-exports/export-ready/media?download=1');
    assert.equal(links[0].hasAttribute('download'),true);
    assert.equal(links[0].getAttribute('rel'),'noreferrer');
    assert.deepEqual([...dom.window.document.querySelectorAll('video')].map(video=>video.getAttribute('src')),[artifact.outputUrl]);
    dom.window.close();
  }
});
