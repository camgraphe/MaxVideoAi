import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import test from 'node:test';

async function fixture(locale = 'fr', livePrice = false) {
  const bundle = await build({ absWorkingDir: path.resolve('frontend'), bundle: true, write: false,
    format: 'iife', platform: 'browser', jsx: 'automatic', tsconfig: 'tsconfig.json',
    define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'estimate-api', setup(b) {
      b.onResolve({filter: /^@\/lib\/authFetch$/}, () => ({path: 'estimate-api', namespace: 'test'}));
      b.onLoad({filter: /.*/, namespace: 'test'}, () => ({contents: 'export const authFetch=(url,init)=>window.requestPrice(url,init)', loader: 'ts'}));
    }}],
    stdin: { resolveDir: path.resolve('frontend'), loader: 'tsx', contents: `
      import React,{act} from 'react';import {createRoot} from 'react-dom/client';
      import {useCharacterBuilderPrice} from './src/components/tools/character-builder/_hooks/useCharacterBuilderPrice';
      import {CharacterStudioComposer} from './src/components/tools/character-builder/_components/CharacterStudioComposer.client';
      import {getCharacterStudioCopy} from './src/components/tools/character-builder/_lib/character-studio-copy';
      import {DEFAULT_CHARACTER_COPY} from './src/components/tools/character-builder/_lib/character-builder-copy';
      import {createDefaultCharacterBuilderState} from './src/lib/character-builder';
      window.IS_REACT_ACT_ENVIRONMENT=true;const root=createRoot(document.getElementById('root'));
      function Composer({price=window.price,status=window.status,retry=()=>window.retries++}) { return <CharacterStudioComposer
        state={createDefaultCharacterBuilderState()} setState={()=>{}} copy={DEFAULT_CHARACTER_COPY}
        labels={getCharacterStudioCopy(window.locale)} locale={window.locale} navigation={null}
        identitySlot={null} styleSlot={null} busy={false} price={price}
        canGenerate={price!==null} priceStatus={status} onRetryPrice={retry}
        onGenerate={()=>window.generations++}/>; }
      function LivePrice(){const p=useCharacterBuilderPrice(window.resolution,window.references);return <Composer price={p.displayedPrice?.usd??null} status={p.status} retry={p.refreshPrice}/>}
      window.fx={act,unmount:()=>root.unmount(),render:()=>root.render(window.livePrice?<LivePrice/>:<Composer/>)};
    ` },
  });
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', runScripts: 'dangerously' });
  const w = dom.window as any;
  w.MessageChannel = class { port1 = { onmessage: () => {} }; port2 = { postMessage: () => setTimeout(() => this.port1.onmessage(), 0) }; };
  w.process = { env: {} }; w.locale = locale; w.price = null; w.status = 'loading'; w.retries = 0; w.generations = 0;
  w.livePrice=livePrice; w.resolution='1k'; w.references=0; w.requests=[];
  w.requestPrice=(url: string, init: any)=>new Promise(resolve=>w.requests.push({url,body:JSON.parse(init.body),resolve}));
  w.eval(bundle.outputFiles[0].text);
  await w.fx.act(async () => w.fx.render());
  return { w, doc: w.document, render: () => w.fx.act(async () => w.fx.render()),
    close: async () => { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); } };
}

test('image price distinguishes loading from failure and offers an explicit safe retry', async () => {
  const f = await fixture();
  try {
    const generate = () => f.doc.querySelector('.app-generation-action');
    assert.match(generate().textContent, /Calcul du prix/);
    assert.equal(generate().disabled, true);
    assert.doesNotMatch(f.doc.body.textContent, /Tarif indisponible/);
    f.w.status = 'error'; await f.render();
    const alert = f.doc.querySelector('[role="alert"]');
    assert.match(alert?.textContent ?? '', /prix.*indisponible|récupérer le prix/i);
    assert.match(alert?.textContent ?? '', /choix.*conservés/i);
    assert.equal(generate().getAttribute('aria-describedby'), alert.id);
    const retry = [...f.doc.querySelectorAll('button')].find((b: any) => /Réessayer/.test(b.textContent)) as any;
    assert.ok(retry); await f.w.fx.act(async () => retry.click());
    assert.equal(f.w.retries, 1); assert.equal(f.w.generations, 0);
    f.w.status = 'ready'; f.w.price = .07; await f.render();
    assert.match(generate().textContent, /0,07/);
    assert.equal(generate().disabled, false);
    assert.equal(f.doc.querySelector('[role="alert"]'), null);
    assert.equal(f.w.generations, 0, 'recovering a price must never submit a paid generation');
  } finally { await f.close(); }
});


test('current price follows format and references, rejects old responses and recovers without generating', async () => {
  const f = await fixture('en', true);
  const settle = async (request: any, cents: number | null) => f.w.fx.act(async () => {
    request.resolve({ok:cents!==null,json:async()=>({ok:cents!==null,pricing:{totalCents:cents,currency:'USD',meta:{pricingMode:'manual_tariff',customerTariffRevision:1}}})});
  });
  try {
    const first=f.w.requests[0]; assert.equal(first.body.resolution,'1k');
    f.w.resolution='4k'; await f.render(); const next=f.w.requests[1];
    assert.equal(next.body.resolution,'4k');
    await settle(next,23); assert.match(f.doc.querySelector('.app-generation-price').textContent,/0.23/);
    await settle(first,7); assert.match(f.doc.querySelector('.app-generation-price').textContent,/0.23/);
    f.w.references=1; await f.render(); const ref=f.w.requests[2];
    assert.equal(ref.body.mode,'i2i'); assert.equal(ref.body.referenceImageCount,1);
    assert.equal(f.doc.querySelector('.app-generation-action').disabled,true);
    assert.doesNotMatch(f.doc.querySelector('.app-generation-price').textContent,/0.23/);
    await settle(ref,null); assert.ok(f.doc.querySelector('[role="alert"]'));
    const retry=[...f.doc.querySelectorAll('button')].find((b:any)=>b.textContent==='Retry price') as any;
    await f.w.fx.act(async()=>retry.click()); const retried=f.w.requests[3]; assert.ok(retried);
    assert.match(f.doc.querySelector('.app-generation-price').textContent,/Calculating/);
    await settle(retried,23); assert.equal(f.doc.querySelector('.app-generation-action').disabled,false);
    assert.equal(f.w.generations,0);
  } finally { await f.close(); }
});
