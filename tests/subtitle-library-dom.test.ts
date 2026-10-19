import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';
const stubs = {
  '@/lib/authFetch': 'export const authFetch=(url,init)=>window.fixtureFetch(url,init);',
  '@/hooks/useRequireAuth': 'export const useRequireAuth=()=>window.auth;',
  '@/lib/i18n/I18nProvider': "export const useI18n=()=>({locale:'en'});",
  '@/components/HeaderBar': 'export const HeaderBar=()=>null;',
  '@/components/AppSidebar': 'export const AppSidebar=()=>null;',
  '@/components/library/MediaVisitorIntro.client': 'export const MediaVisitorIntro=()=>null;',
  'next/link': "import React from 'react';export default p=>React.createElement('a',{href:p.href},p.children);",
};
const doc = (id: string, revision=1) => ({ id, revision, language:'en', excerpt:`Caption ${id}`, durationMs:10000, updatedAt:'2026-10-19T12:00:00Z' });
const buttons = (w: any) => Array.from(w.document.querySelectorAll('button')) as any[];
test('subtitle library paginates owned summaries and pins links to the displayed revision', async () => {
  const f = await mountToolFixture("import {SubtitleLibraryPage as App} from './app/(core)/(workspace)/app/library/subtitles/_components/SubtitleLibraryPage.client';",stubs,w=>{w.auth={user:{id:'A'},loading:false};});
  try {
    assert.match(f.w.requests[0].url,/limit=30/);
    await f.respond(f.w.requests[0],{ok:true,documents:[doc('first',3)],nextCursor:'opaque'});
    const more = buttons(f.w).find(button=>button.textContent==='Load more');assert.ok(more);
    await f.act(async()=>more.click());assert.match(f.w.requests[1].url,/cursor=opaque/);
    await f.respond(f.w.requests[1],{ok:true,documents:[doc('first',3),doc('second',2)],nextCursor:null});
    assert.equal(f.w.document.querySelectorAll('li').length,2);
    const hrefs=Array.from(f.w.document.querySelectorAll('a')).map((a:any)=>a.getAttribute('href'));
    assert.ok(hrefs.includes('/app/tools/subtitles?document=first&revision=3'));
    assert.ok(hrefs.includes('/api/tools/subtitles/documents/first/download?format=srt&revision=3'));
    assert.equal(buttons(f.w).some(button=>button.textContent==='Load more'),false);
  }finally{await f.close();}
});
test('late list responses cannot repopulate the subtitle library after account changes',async()=>{
  const f = await mountToolFixture("import {SubtitleLibraryPage as App} from './app/(core)/(workspace)/app/library/subtitles/_components/SubtitleLibraryPage.client';",stubs,w=>{w.auth={user:{id:'A'},loading:false};});
  try {
    const old=f.w.requests[0];f.w.auth={user:{id:'B'},loading:false};await f.render();
    assert.equal(old.init.signal.aborted,true);
    await f.respond(old,{ok:true,documents:[doc('private-A')],nextCursor:null});
    assert.doesNotMatch(f.w.document.body.textContent,/private-A/);
    await f.respond(f.w.requests[1],{ok:true,documents:[doc('owned-B')],nextCursor:null});
    assert.match(f.w.document.body.textContent,/owned-B/);assert.doesNotMatch(f.w.document.body.textContent,/private-A/);
    assert.ok(f.w.requests.every((request:any)=>!request.init.method||request.init.method==='GET'));
  }finally{await f.close();}
});
