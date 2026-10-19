import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizePublicQueryParams, shouldMarkTrackingNoindex } from '../frontend/lib/middleware/routing-query';

const require = createRequire(import.meta.url);
const frontendRequire = createRequire(resolve('frontend/package.json'));
const { NextRequest } = frontendRequire('next/server') as typeof import('next/server');
const origin = 'https://maxvideoai.test';

async function loadContact() {
  const directory = await mkdtemp(join(tmpdir(), 'contact-return-'));
  const output = join(directory, 'fixture.cjs');
  const boundaries: Record<string, string> = {
    '@/server/mailer': `export const getDefaultFromAddress=()=> 'fixture@example.invalid'; export const getMailer=()=>({sendMail:async()=>{if(globalThis.contactFixture.fail)throw Error('Synthetic failure');globalThis.contactFixture.sent++}});`,
    '@/server/slack': 'export const postSlackMessage=async()=>{};',
    '../default-marketing-layout': 'export default ({children})=>children;',
    '@/lib/i18n/server': `import en from '${resolve('frontend/messages/en.json')}';import fr from '${resolve('frontend/messages/fr.json')}';import es from '${resolve('frontend/messages/es.json')}';export const resolveDictionary=async({locale})=>({dictionary:{en,fr,es}[locale]});`,
    '@/i18n/navigation': 'export const Link=({children,...props})=><a {...props}>{children}</a>;',
  };
  await build({
    stdin: { contents: `export {POST} from './frontend/app/api/contact/route';export {default as English} from './frontend/app/contact/page';export {default as Localized, generateMetadata} from './frontend/app/(localized)/[locale]/(marketing)/contact/page';`, resolveDir: process.cwd() },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', tsconfig: 'frontend/tsconfig.json', logLevel:'silent',
    plugins: [{name:'offline-contact',setup(b){
      b.onResolve({filter:/.*/},a=>{
        if(a.path in boundaries)return {path:a.path,namespace:'fixture'};
        if(!a.path.startsWith('.')&&!a.path.startsWith('/')&&!a.path.startsWith('@/'))return {path:frontendRequire.resolve(a.path),external:true};
      });
      b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:boundaries[a.path],loader:'tsx',resolveDir:resolve('frontend')}));
    }}],
  });
  return { module: require(output), dispose:()=>rm(directory,{recursive:true,force:true}) };
}

// Resolve only the two server route owners; all form JSX renders through React.
async function renderPage(module: Awaited<ReturnType<typeof loadContact>>['module'], locale: string, params: Record<string,string>) {
  let element;
  const searchParams = Promise.resolve(params);
  if(locale==='en') {
    const wrapper=module.English({searchParams});
    const child=wrapper.props.children;
    element=await child.type(child.props);
  } else element=await module.Localized({params:Promise.resolve({locale}),searchParams});
  return renderToStaticMarkup(element);
}

test('native contact submits return a GET with the visible result in EN/FR/ES; JSON clients retain their contract',async()=>{
 const fixture=await loadContact(); const previous=process.env.CONTACT_RECIPIENT_EMAIL;
 const oldFixture=Object.getOwnPropertyDescriptor(globalThis,'contactFixture');
 const adapter={fail:false,sent:0}; Object.defineProperty(globalThis,'contactFixture',{value:adapter,configurable:true});
 process.env.CONTACT_RECIPIENT_EMAIL='fixture@example.invalid';
 try {
  for(const locale of ['en','fr','es']) for(const failure of [false,true]) {
   adapter.fail=failure;
   const page=locale==='en'?'/contact':`/${locale}/contact`;
   const body=new URLSearchParams({name:'Synthetic',email:'synthetic@example.invalid',message:'Offline fixture only',locale});
   const response=await fixture.module.POST(new NextRequest(origin+'/api/contact',{method:'POST',headers:{accept:'text/html',referer:origin+page+(failure?'?submitted=1':'?error=1&error_code=send_failed')},body}));
   assert.equal(response.status,303, 'native submission must use Post/Redirect/Get');
   const location=new URL(response.headers.get('location')!);
   assert.equal(location.pathname,page);
   assert.equal(location.searchParams.get(failure?'error':'submitted'),'1');
   assert.equal(location.searchParams.has(failure?'submitted':'error'),false,'old outcome must be cleared');
   assert.equal(normalizePublicQueryParams(new NextRequest(location),page),null,'GET must preserve the result');
   const html=await renderPage(fixture.module,locale,Object.fromEntries(location.searchParams));
   assert.ok(html.includes(failure?'--error-bg':'--success-bg'), `${locale} must render its result`);
   assert.ok(!html.includes(failure?'--success-bg':'--error-bg'));
   const metadata=await fixture.module.generateMetadata({params:Promise.resolve({locale})});
   assert.ok(!String(metadata.alternates.canonical).includes('?'));
   const json=await fixture.module.POST(new NextRequest(origin+'/api/contact',{method:'POST',headers:{accept:'application/json'},body}));
   assert.equal(json.status,failure?500:200); assert.deepEqual(await json.json(),failure?{ok:false,error:'send_failed'}:{ok:true});
  }
  adapter.fail=false;
  const missingReferer=await fixture.module.POST(new NextRequest(origin+'/api/contact',{method:'POST',body:new URLSearchParams({name:'Synthetic',email:'synthetic@example.invalid',message:'Offline fixture only',locale:'en'})}));
  assert.equal(new URL(missingReferer.headers.get('location')!).pathname,'/contact');
 }finally{
  if(previous===undefined)delete process.env.CONTACT_RECIPIENT_EMAIL;else process.env.CONTACT_RECIPIENT_EMAIL=previous;
  if(oldFixture)Object.defineProperty(globalThis,'contactFixture',oldFixture);else Reflect.deleteProperty(globalThis,'contactFixture');
  await fixture.dispose();
 }
});

for(const page of ['/contact','/fr/contact','/es/contact']) test(`${page} keeps functional flags, strips unrelated parameters, and excludes result URLs from indexing`,()=>{
 const request=new NextRequest(origin+page+'?submitted=1&unrelated=drop');
 const response=normalizePublicQueryParams(request,page)!;
 assert.equal(response.status,301);
 assert.equal(new URL(response.headers.get('location')!).search,'?submitted=1');
 assert.equal(shouldMarkTrackingNoindex(new NextRequest(origin+page+'?submitted=1'),page,false),true);
 assert.equal(shouldMarkTrackingNoindex(new NextRequest(origin+page),page,false),false);
});

test('English contact wrapper forwards the submitted and error flags to the visible form',async()=>{
 const fixture=await loadContact();
 try {
  assert.ok((await renderPage(fixture.module,'en',{submitted:'1'})).includes('--success-bg'));
  assert.ok((await renderPage(fixture.module,'en',{error:'1'})).includes('--error-bg'));
 }finally{await fixture.dispose();}
});
