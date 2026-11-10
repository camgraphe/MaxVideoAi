import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
const bundle = bundleClientFlow(`import React,{act}from'react';import{createRoot}from'react-dom/client';import{LibraryCharacters}from'./components/library/LibraryCharacters.client';const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<LibraryCharacters key={window.owner} userId={window.owner} locale="en" navigation={<span>Library</span>}/>),unmount:()=>root.unmount()};`, {
  '@/lib/owned-auth-fetch': 'export const ownedAuthFetch=(url,owner)=>window.readFixture(url,owner);',
  '@/lib/supabaseClientLoader': 'export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}});',
  'next/link': 'export default function Link({href,prefetch,children,...props}){return <a href={href} {...props}>{children}</a>}',
  'next/navigation': 'export const useRouter=()=>({push(){}}); export const usePathname=()=>"/app/library"; export const useSearchParams=()=>new URLSearchParams();',
});
test('characters use saved identities and paginated looks, and retire an earlier account response', async () => {
  const dom = createClientFlowDom('/app/library'), w = dom.window as any;
  w.owner = 'alice'; const requests: { url: string; owner: string }[] = [];
  let resolveAlice!: (value: unknown) => void;
  const identity = { jobId: 'identity-job', imageUrl: 'https://example.invalid/identity.png', thumbUrl: 'https://example.invalid/thumb.png', settingsSnapshot: {} };
  const summary = { id: '42', name: 'Saved character', identity, lookCount: 2 };
  w.readFixture = (url: string, owner: string) => {
    requests.push({ url, owner });
    if (owner === 'alice') return new Promise(resolve => { resolveAlice = resolve; });
    const body = url.includes('/42') ? { character: { ...summary, looks: [{ id: url.includes('beforeLook') ? '2' : '1', name: url.includes('beforeLook') ? 'Second look' : 'First look', ...identity }], nextLookCursor: url.includes('beforeLook') ? null : '1' } } : { characters: [summary], nextCursor: null };
    return Promise.resolve({ ok: true, json: async () => ({ ok: true, ...body }) });
  };
  const settle = async () => { for (let i = 0; i < 8; i++) await w.fx.act(async () => new Promise(r => setTimeout(r, 5))); };
  w.eval(await bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    w.owner = 'bob'; await w.fx.act(async () => w.fx.render()); await settle();
    await w.fx.act(async () => resolveAlice({ ok: true, json: async () => ({ ok: true, characters: [{ ...summary, name: 'Foreign stale identity' }], nextCursor: null }) })); await settle();
    assert.ok(!w.document.body.textContent.includes('Foreign stale identity'));
    const card = w.document.querySelector('.library-character-card'); assert.ok(card);
    await w.fx.act(async () => card.click()); await settle();
    assert.ok(w.document.body.textContent.includes('Identity'));
    assert.ok(w.document.body.textContent.includes('First look'));
    assert.ok(w.document.querySelector('a[href="/app/tools/character-builder?tab=characters&character=42"]'));
    const more = [...w.document.querySelectorAll('button')].find((button: any) => button.textContent === 'Load more looks') as any;
    assert.ok(more); await w.fx.act(async () => more.click()); await settle();
    assert.equal(w.document.querySelectorAll('.library-character-card').length, 3);
    assert.ok(requests.some(request => request.owner === 'bob' && request.url.endsWith('/42?beforeLook=1')));
    assert.ok([...w.document.querySelectorAll('img')].every((img: any) => img.src.endsWith('/thumb.png')), 'browsing identities and looks uses stored thumbnails');
  } finally { await w.fx.act(async () => w.fx.unmount()); w.close(); }
});
