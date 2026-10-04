import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

const requireFrontend = createRequire(resolve('frontend/package.json'));

test('SEO saves invalidate both watch identifiers only after persistence; rejected saves leave cache intact', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'video-seo-save-'));
  const previous = { id: 'public-video', canonicalSlug: 'previous-slug', intent: 'model-demo' };
  const saved = { ...previous, canonicalSlug: 'new-slug' };
  const fixture = { valid: true, writeFails: false, events: [] as string[], previous, saved };
  (globalThis as any).__seoSave = fixture;
  t.after(() => { delete (globalThis as any).__seoSave; rmSync(directory, {recursive:true, force:true}); });
  const mocks: Record<string,string> = {
    '@/lib/db': 'export const isDatabaseConfigured=()=>true;',
    '@/server/admin': 'export const requireAdmin=async()=>"admin"; export const adminErrorToResponse=()=>new Response(null,{status:403});',
    '@/server/videos': 'export const getSeoVideoById=async()=>({videoUrl:"https://media.maxvideoai.com/public.mp4",thumbUrl:"https://media.maxvideoai.com/poster.jpg",visibility:"public",indexable:true});',
    'next/cache': 'export const revalidatePath=(path)=>globalThis.__seoSave.events.push(path);',
    '@/server/video-seo-editorial': `const f=()=>globalThis.__seoSave;
      export const listVideoSeoEditorialEntries=async()=>[f().previous];
      export const normalizeVideoSeoEditorialInput=()=>f().saved;
      export const validateVideoSeoEditorialUpdatePayload=()=>({ok:f().valid,entry:f().saved,error:'Rejected'});
      export const buildDraftVideoSeoEditorialEntry=()=>f().saved;
      export const upsertVideoSeoEditorialEntry=async()=>{if(f().writeFails)throw Error('Write failed');f().events.push('persist');return f().saved;};
      export const removeVideoSeoEditorialEntryFromRollout=upsertVideoSeoEditorialEntry;`,
  };
  async function load(entry:string,name:string) {
    const file=join(directory,`${name}.cjs`);
    await build({entryPoints:[entry],outfile:file,bundle:true,platform:'node',format:'cjs',packages:'external',tsconfig:'frontend/tsconfig.json',plugins:[{name:'fixtures',setup(builder){
      builder.onResolve({filter:/.*/},args=>args.path in mocks?{path:args.path,namespace:'fixture'}:args.path==='next/server'?{path:requireFrontend.resolve(args.path),external:true}:undefined);
      builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'ts'}));
    }}]});
    return requireFrontend(file);
  }
  const edit=await load('frontend/app/api/admin/video-seo/[videoId]/route.ts','edit');
  const create=await load('frontend/app/api/admin/video-seo/route.ts','create');
  const request=()=>new Request('http://localhost/api/admin/video-seo/public-video',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({videoId:'public-video',modelSlug:'wan-3',examplesSlug:'wan'})});
  const props={params:Promise.resolve({videoId:'public-video'})};
  const response=await edit.PUT(request(),props);
  assert.equal(response.status,200);
  assert.equal(fixture.events[0],'persist');
  for(const path of ['/video/public-video','/video/previous-slug','/video/new-slug']) assert.ok(fixture.events.includes(path),`invalidate ${path}`);
  fixture.events=[]; fixture.valid=false;
  assert.equal((await edit.PUT(request(),props)).status,400); assert.deepEqual(fixture.events,[]);
  fixture.valid=true; fixture.writeFails=true;
  assert.equal((await edit.PUT(request(),props)).status,400); assert.deepEqual(fixture.events,[]);
  fixture.writeFails=false;
  for(const action of [()=>edit.DELETE(request(),props),()=>create.POST(request())]) {
    fixture.events=[]; assert.equal((await action()).status,200);
    assert.equal(fixture.events[0],'persist');
    assert.ok(fixture.events.includes('/video/public-video'));assert.ok(fixture.events.includes('/video/new-slug'));
    assert.ok(fixture.events.includes('/sitemap-video.xml'));assert.ok(fixture.events.includes('/sitemap-video-pages.xml'));
  }
});
