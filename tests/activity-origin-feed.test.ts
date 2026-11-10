import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

test('Activity provenance is opt-in and isolated from ordinary feeds, option transitions and late responses', async () => {
  const frontend = path.resolve('frontend');
  const stubs: Record<string, string> = {
    '@/lib/authFetch': 'export const authFetch=url=>window.fixtureFetch(url);',
    '@/lib/last-known': 'export const readLastKnownUserId=()=>window.fixtureUser;export const writeLastKnownUserId=id=>{window.fixtureUser=id;};',
    '@/lib/supabase-session-hint': 'export const hasSupabaseAuthCookie=()=>true;',
    '@/lib/supabaseClient': `export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:window.fixtureUser}}}}),
      onAuthStateChange:fn=>{window.authListeners.push(fn);return{data:{subscription:{unsubscribe(){window.authListeners=window.authListeners.filter(value=>value!==fn);}}}}}}};`,
  };
  const bundle = await build({
    absWorkingDir: frontend, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', write: false,
    define: { 'process.env.NODE_ENV': '"test"', 'process.env.S3_PUBLIC_BASE_URL': '""', 'process.env.S3_BUCKET': '""', 'process.env.S3_REGION': '""' },
    tsconfig: path.join(frontend, 'tsconfig.json'),
    plugins: [{ name: 'activity-feed-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: frontend }));
    } }],
    stdin: { loader: 'tsx', resolveDir: frontend, contents: `
      import React,{act} from 'react';import{createRoot}from'react-dom/client';import{SWRConfig}from'swr';
      import{useInfiniteJobs}from'./lib/api-jobs';
      window.IS_REACT_ACT_ENVIRONMENT=true;window.fixtureUser='owner';window.authListeners=[];window.requests=[];
      window.hold=false;window.release=null;
      window.fixtureFetch=async url=>{
        const params=new URL(url,'http://localhost').searchParams,user=window.fixtureUser;
        const includeOrigin=params.get('includeActivityOrigin')==='1',cursor=params.get('cursor');
        window.requests.push(url);
        if(window.hold&&includeOrigin)await new Promise(resolve=>{window.release=resolve;});
        return{ok:true,status:200,json:async()=>({ok:true,nextCursor:cursor?null:'older',jobs:[{
          jobId:user+'-'+(cursor||'first'),surface:'video',engineLabel:'Fixture',durationSec:5,prompt:'',
          createdAt:cursor?'2026-11-09T10:00:00Z':'2026-11-10T10:00:00Z',status:'completed',
          ...(includeOrigin?{activityOrigin:{kind:'studio',projectId:user+'-project'}}:{})
        }]})};
      };
      let includeActivityOrigin=false;const cache=new Map();
      function Fixture(){window.plain=useInfiniteJobs(24);window.activity=useInfiniteJobs(24,{includeActivityOrigin});return null;}
      const root=createRoot(document.getElementById('root'));
      const render=()=>root.render(<SWRConfig value={{provider:()=>cache,dedupingInterval:0,shouldRetryOnError:false}}><Fixture/></SWRConfig>);
      window.fixture={act,render,origin(value){includeActivityOrigin=value;render();},unmount(){root.unmount();}};
    ` },
  });
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/jobs', runScripts: 'dangerously' });
  (dom.window as any).MessageChannel = class {
    port1 = { onmessage: () => {} };
    port2 = { postMessage: () => setTimeout(() => this.port1.onmessage(), 0) };
  };
  dom.window.eval(bundle.outputFiles[0].text);
  const w = dom.window as any;
  const settle = async () => { await w.fixture.act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); }); };
  try {
    await w.fixture.act(async () => w.fixture.render()); await settle();
    assert.equal(w.requests.length, 1, 'ordinary consumers retain their shared cache');
    assert.equal(w.requests[0], '/api/jobs?limit=24');
    assert.equal(w.plain.stableJobs[0].activityOrigin, undefined);

    w.hold = true;
    await w.fixture.act(async () => w.fixture.origin(true));
    assert.equal(w.activity.stableJobs.length, 0, 'new projection scope cannot display the previous feed snapshot');
    assert.equal(w.plain.stableJobs[0].jobId, 'owner-first');
    assert.equal(w.requests[1], '/api/jobs?limit=24&includeActivityOrigin=1');

    await w.fixture.act(async () => w.fixture.origin(false)); await settle();
    assert.equal(w.activity.stableJobs[0].activityOrigin, undefined);
    w.hold = false;
    await w.fixture.act(async () => w.release()); await settle();
    assert.equal(w.activity.stableJobs[0].activityOrigin, undefined, 'late Activity responses cannot enter the ordinary scope');

    await w.fixture.act(async () => w.fixture.origin(true)); await settle();
    assert.equal(w.activity.stableJobs[0].activityOrigin.projectId, 'owner-project');
    assert.equal(w.plain.stableJobs[0].activityOrigin, undefined, 'Activity responses cannot enrich other consumers sharing the account');
    await w.fixture.act(async () => { await w.activity.setSize(2); }); await settle();
    assert.equal(w.activity.stableJobs.length, 2);
    assert.ok(w.requests.some((url: string) => url === '/api/jobs?limit=24&cursor=older&includeActivityOrigin=1'));
    assert.equal(w.plain.stableJobs.length, 1);

    await w.fixture.act(async () => {
      for (const listener of w.authListeners) await listener('SIGNED_IN', { user: { id: 'other' } });
    }); await settle();
    assert.equal(w.activity.stableJobs[0].jobId, 'other-first');
    assert.equal(w.activity.stableJobs[0].activityOrigin.projectId, 'other-project');
    assert.equal(w.activity.size, 1);
    assert.equal(w.plain.stableJobs[0].activityOrigin, undefined);
  } finally { await w.fixture.act(async () => w.fixture.unmount()); dom.window.close(); }
});
