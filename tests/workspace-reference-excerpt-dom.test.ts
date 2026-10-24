import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
const bundle = bundleClientFlow(`
import React,{act} from 'react';import {createRoot} from 'react-dom/client';
import {Composer} from './components/Composer';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {useWorkspaceAssetState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import {useWorkspaceVideoExcerpt} from './app/(core)/(workspace)/app/_hooks/useWorkspaceVideoExcerpt';
import {summarizeWorkspaceInputSchema} from './app/(core)/(workspace)/app/_lib/workspace-input-schema';
import {getBaseEngineIncludingHidden} from './src/lib/engines';
function Main(){const state=useWorkspaceAssetState('owner');const engine=getBaseEngineIncludingHidden('wan-3');
const actions=useWorkspaceVideoExcerpt({accountScope:'owner',engine,mode:window.mode,inputAssets:state.inputAssets,commitInputAssetMutation:state.commitInputAssetMutation});
const schema=summarizeWorkspaceInputSchema({selectedEngine:engine,activeMode:window.mode,uiLocale:'fr',allowsUnifiedVeoFirstLast:false,isUnifiedHappyHorse:false,isUnifiedSeedance:false,isUnifiedGeminiOmni:false});
window.probe={...state,...actions};
return <I18nProvider locale="fr" dictionary={{}} fallback={{}}><Composer density="workspace" engine={engine} caps={{modes:[window.mode]}} prompt="Changer le décor" onPromptChange={()=>{}} price={99} currency="USD" isLoading={false} onGenerate={()=>{window.generated=true}} assetFields={schema.assetFields} assets={state.inputAssets} onPrepareVideoExcerpt={actions.handlePrepareVideoExcerpt} onVideoExcerptEditorChange={actions.handleVideoExcerptEditorChange}/></I18nProvider>}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<Main/>),unmount:()=>root.unmount()};
`, { '@/lib/supabaseClient': `export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'owner'},access_token:'test-owner'}},error:null})}};` });

for (const kind of ['video', 'audio'] as const) test(`${kind} reference: shared selection prepares the correct owned slot and leaves other references untouched`, async () => {
  const dom = createClientFlowDom('/app'), w = dom.window as any;
  const fieldId = `reference_${kind}_urls`;
  const ref = { type: 'asset', assetId: 'ma_11111111111111111111111111111111', kind };
  const original = { id: 'original', assetId: ref.assetId, ref, kind, fieldId, name: kind === 'audio' ? 'voix.wav' : 'telephone.mp4',
    type: kind === 'audio' ? 'audio/wav' : 'video/mp4', url: 'https://canonical.invalid/original', previewUrl: 'https://access.invalid/original', size: 100, durationSec: 20, status: 'ready' };
  w.mode = 'ref2v'; w.sessionStorage.setItem('last-known:user-id', 'owner');
  w.HTMLMediaElement.prototype.pause = () => {}; w.HTMLMediaElement.prototype.load = () => {};
  const requests: any[] = [];
  w.fetch = async (url: string, init: RequestInit) => {
    requests.push({ url, body: JSON.parse(String(init.body)) });
    if (url.endsWith('/source')) return { ok: true, json: async () => ({ ok: true, previewUrl: 'https://access.invalid/full-original' }) };
    return { ok: true, json: async () => ({ ok: true, asset: { id: 'prepared', assetId: 'ma_22222222222222222222222222222222', ref: { ...ref, assetId: 'ma_22222222222222222222222222222222' },
      url: 'https://canonical.invalid/prepared', previewUrl: 'https://access.invalid/prepared', durationSec: 5, size: 80, mime: original.type, name: 'passage' } }) };
  };
  const button = (label: string) => Array.from(w.document.querySelectorAll('button')).find((node: any) => node.textContent.trim() === label) as HTMLButtonElement;
  try {
    w.eval(await bundle); await w.fx.act(async () => w.fx.render());
    const image = { id: 'image', kind: 'image', name: 'image.png', type: 'image/png', size: 1, url: 'https://image.invalid/a', previewUrl: 'https://image.invalid/a', status: 'ready' };
    await w.fx.act(async () => w.probe.setInputAssets({ [fieldId]: [original], reference_image_urls: [image] }));
    const choose = button('Choisir un passage'); assert.ok(choose);
    await w.fx.act(async () => choose.click());
    const dialog = w.document.querySelector('[role=dialog]'); assert.ok(dialog);
    assert.equal(dialog.querySelector(kind)?.getAttribute('preload'), 'none');
    assert.equal(dialog.querySelector(kind)?.getAttribute('src'), 'https://access.invalid/full-original');
    assert.equal(requests.length, 1, 'opening only requests owned full-media read access');
    assert.equal(requests[0].url, `/api/uploads/${kind}/excerpt/source`);
    await w.fx.act(async () => button('Annuler').click());
    assert.equal(requests.length, 1, 'cancel creates no asset');
    await w.fx.act(async () => button('Choisir un passage').click());
    for (const [label, value] of [['Début (secondes)', '4'], ['Fin (secondes)', '9']]) {
      const input = w.document.querySelector(`input[aria-label="${label}"]`);
      await w.fx.act(async () => { Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new w.Event('input', { bubbles: true })); });
    }
    await w.fx.act(async () => button('Utiliser ce passage').click());
    const request = requests.find(entry => !entry.url.endsWith('/source'));
    assert.equal(request.url, `/api/uploads/${kind}/excerpt`);
    assert.deepEqual(request.body, { source: ref, engineId: 'wan-3', mode: 'ref2v', fieldId, range: { startSec: 4, endSec: 9 } });
    assert.equal(w.probe.inputAssets[fieldId][0].durationSec, 5);
    assert.equal(w.probe.inputAssets[fieldId][0].kind, kind);
    assert.equal(w.probe.inputAssets[fieldId][0].url, 'https://canonical.invalid/prepared');
    assert.equal(w.probe.inputAssets[fieldId][0].excerptSource.url, original.url);
    assert.equal(JSON.stringify(w.probe.inputAssets.reference_image_urls), JSON.stringify([image]));
    assert.equal(w.generated, undefined);
    assert.equal(w.document.querySelector('[role=dialog]'), null);
  } finally { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); }
});
