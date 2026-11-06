import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

for (const engineId of ['gpt-image-2-6-flare', 'gpt-image-2-6-sunburst']) {
  test(`${engineId} waits for a supported resolution before requesting a price`, async () => {
    const fixture = await mountToolFixture(`
      import {SWRConfig} from 'swr';
      import {listFalEngines} from './src/config/falEngines';
      import {useImageWorkspacePricing} from './app/(core)/(workspace)/app/image/_hooks/useImageWorkspacePricing';
      const caps=listFalEngines().find(entry=>entry.id==='${engineId}').engine;
      function Price(){
        const [resolution,setResolution]=useState('1k');window.setResolution=setResolution;
        const result=useImageWorkspacePricing({selectedEngineId:'${engineId}',selectedEngineCaps:caps,
          mode:'t2i',numImages:1,resolution,quality:'high',complexity:'low',aspectRatio:null,
          customImageWidth:'',customImageHeight:'',enableWebSearch:false,readyReferenceSizes:[],
          referenceSizeSignature:'',referenceImageCount:0});
        return <output>{result.pricingSnapshot?.totalCents??'pending'}</output>;
      }
      const cache=new Map();
      function App(){return <SWRConfig value={{provider:()=>cache}}><Price/></SWRConfig>}
    `, { '@/lib/authFetch': 'export const authFetch=(url,init)=>window.fixtureFetch(url,init);' });
    try {
      assert.equal(fixture.w.requests.length, 0, 'the stale resolution must not reach the API');
      await fixture.act(async () => fixture.w.setResolution('1024x1024'));
      assert.equal(fixture.w.requests.length, 1);
      const request = fixture.w.requests[0];
      assert.equal(request.url, '/api/images/estimate');
      const body = JSON.parse(request.init.body);
      assert.equal(body.engineId, engineId);
      assert.equal(body.resolution, '1024x1024');
      assert.equal(body.complexity, 'low');
      await fixture.respond(request, { ok: true, pricing: { totalCents: 10 } });
      assert.equal(fixture.w.document.querySelector('output').textContent, '10');
      await fixture.act(async () => fixture.w.setResolution('1k'));
      assert.equal(fixture.w.requests.length, 1, 'an incompatible transition must not submit another estimate');
      assert.equal(fixture.w.document.querySelector('output').textContent, 'pending', 'the old quote must disappear');
    } finally { await fixture.close(); }
  });
}
