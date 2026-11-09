// Explicit diagnostic, outside the normal test discovery. Exit 2 means the
// existing product still has one of the documented integration blockers.
import assert from 'node:assert/strict';
import { bundleClientFlow, createClientFlowDom } from '../../../tests/helpers/client-flow-dom';

const assetId = `ma_${'a'.repeat(32)}`;
const asset = {
  id: 'url:internal-row', assetId, ref: { type: 'asset', assetId, kind: 'image' },
  name: 'owned.png', kind: 'image', source: 'upload',
  url: 'https://example.invalid/user-assets/owner/original.png',
  width: 1024, height: 1024, mime: 'image/png', size: 1024,
  durationSec: 12.5,
  mediaFacts: { source: 'probe', durationSec: 12.5, width: 1024, height: 1024 },
};
const observations: { name: string; desired: unknown; observed: unknown; satisfied: boolean }[] = [];

async function settle(w: any, predicate: () => boolean, label: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await w.fx.act(async () => new Promise(resolve => setTimeout(resolve, 5)));
  }
  assert.fail(`Diagnostic fixture did not settle: ${label}`);
}

async function libraryProjection() {
  const bundle = await bundleClientFlow(`
    import React,{act} from 'react'; import {createRoot} from 'react-dom/client';
    import {SWRConfig} from 'swr';
    import {useLibraryPageData} from './app/(core)/(workspace)/app/library/_hooks/useLibraryPageData';
    function App(){const state=useLibraryPageData({userId:'owner',activeView:'saved',activeKind:'audio',activeSource:'all',toolsEnabled:true});window.state=state;return <output>{state.currentAssets.length}</output>}
    const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
    window.fx={act,render:()=>root.render(<SWRConfig value={{provider:()=>new Map(),revalidateOnFocus:false}}><App/></SWRConfig>),unmount:()=>root.unmount()};
  `, {
    'next/navigation': `export const usePathname=()=>'/app/library';export const useRouter=()=>({replace(){}});export const useSearchParams=()=>new URLSearchParams();`,
    '@/lib/owned-auth-fetch': 'export const ownedAuthFetch=(url)=>window.fetch(url);',
  });
  const dom = createClientFlowDom('/app/library'), w = dom.window as any;
  const audioAsset = { ...asset, kind: 'audio', ref: { ...asset.ref, kind: 'audio' }, name: 'voice.wav', url: 'https://example.invalid/user-assets/owner/voice.wav', mime: 'audio/wav', width: null, height: null, mediaFacts: { source: 'probe', durationSec: 12.5, hasAudio: true } };
  w.fetch = async () => Response.json({ ok: true, assets: [audioAsset], nextCursor: null, hasMore: false });
  w.eval(bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    await settle(w, () => w.state.currentAssets.length === 1, 'saved audio projection');
    const result = w.state.currentAssets[0];
    observations.push({
      name: 'Saved-media projection preserves canonical refs and measured duration',
      desired: { id: audioAsset.id, assetId, ref: audioAsset.ref, durationSec: 12.5 },
      observed: { id: result.id, assetId: result.assetId ?? null, ref: result.ref ?? null, durationSec: result.durationSec ?? null },
      satisfied: result.id === audioAsset.id && result.assetId === assetId && result.ref?.assetId === assetId && result.durationSec === 12.5,
    });
  } finally { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); }
}

async function creatorEligibility(canonicalRow = false) {
  const bundle = await bundleClientFlow(`
    import React,{act} from 'react';import {createRoot} from 'react-dom/client';
    import {CreatorSourcePicker} from './src/components/tools/creator/CreatorSourcePicker.client';
    import {creatorCopy} from './src/components/tools/creator/creator-copy';
    const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
    window.fx={act,render:()=>root.render(<CreatorSourcePicker userId="owner" locale="en" label="Source" kind="image" source={null} onChange={value=>window.selected=value}/>),open:()=>[...document.querySelectorAll('button')].find(b=>b.textContent===creatorCopy('en').library).click(),unmount:()=>root.unmount()};
  `, {
    '@/lib/authFetch': 'export const authFetch=(url)=>window.fetch(url);',
    '@/lib/owned-auth-fetch': 'export const ownedAuthFetch=(url)=>window.fetch(url);',
    '@/lib/client-video-upload': 'export const uploadVideoFile=async()=>{throw Error("Unexpected upload");};',
    '@/lib/i18n/I18nProvider': 'export const useI18n=()=>({locale:"en",t:(_key,fallback)=>fallback});',
  });
  const dom = createClientFlowDom('/app/tools/product-photo-editor'), w = dom.window as any;
  const row = canonicalRow ? { ...asset, id: assetId } : asset;
  w.fetch = async () => Response.json({ ok: true, assets: [row], nextCursor: null, hasMore: false });
  w.eval(bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    await w.fx.act(async () => w.fx.open());
    await settle(w, () => Boolean(w.document.querySelector('.app-picker-card')), 'creator source card');
    const card = w.document.querySelector('.app-picker-card');
    const disabled = card.disabled || card.getAttribute('aria-disabled') === 'true';
    observations.push({ name: canonicalRow ? 'Control: Creator picker accepts a row whose internal id is already canonical' : 'Creator picker accepts an internal row with a valid canonical asset reference', desired: { disabled: false }, observed: { disabled, internalId: row.id, assetId }, satisfied: !disabled });
  } finally { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); }
}

async function recentInsertion(refused: boolean) {
  const bundle = await bundleClientFlow(`
    import React,{act} from 'react';import {createRoot} from 'react-dom/client';
    import {WorkspaceRecentRoleDialog} from './app/(core)/(workspace)/app/_components/WorkspaceRecentRoleDialog.client';
    const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.closed=0;window.inserted=0;
    window.fx={act,render:()=>root.render(<WorkspaceRecentRoleDialog asset={window.asset} fields={[{field:{id:'image_url',type:'image',label:'Source',maxCount:1},required:false}]} inputAssets={{}} mode="i2v" locale="en" onClose={()=>window.closed++} onInsert={async()=>{window.inserted++;return window.insertionResult;}}/>),unmount:()=>root.unmount()};
  `, { '@/lib/i18n/I18nProvider': 'export const useI18n=()=>({locale:"en",t:(_key,fallback)=>fallback});' });
  const dom = createClientFlowDom('/app'), w = dom.window as any;
  w.asset = asset;
  w.insertionResult = refused ? 'The reference capacity changed. Choose another slot.' : undefined;
  w.eval(bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    const insert = w.document.querySelector('.app-recent-insert');
    assert.ok(insert && !insert.disabled, 'the insertion begins from an eligible role');
    await w.fx.act(async () => insert.click());
    assert.equal(w.inserted, 1, 'the actual owner calls the supplied insertion callback once');
    const expectedClosed = refused ? 0 : 1;
    observations.push({ name: refused ? 'A refused recent-media insertion keeps the dialog open' : 'Control: a successful recent-media insertion closes the dialog', desired: { closed: expectedClosed }, observed: { closed: w.closed, inserted: w.inserted }, satisfied: w.closed === expectedClosed });
  } finally { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); }
}

async function main() {
  await libraryProjection();
  await creatorEligibility();
  await creatorEligibility(true);
  await recentInsertion(true);
  await recentInsertion(false);
  console.log(JSON.stringify({ auditedAt: new Date().toISOString(), mode: 'Actual client owners in JSDOM with controlled auth/network boundaries; no production request', observations }, null, 2));
  process.exitCode = observations.every(result => result.satisfied) ? 0 : 2;
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
