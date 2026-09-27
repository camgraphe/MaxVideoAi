import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

async function makeLayoutHarness() {
  const directory = await mkdtemp(join(tmpdir(), 'root-layout-timing-'));
  const fixture = `
    export const calls=[];
    export const tokens={fixture:'theme-token-values'};
    export const failure=new Error('private database detail');
    let releaseLocale;let gate;let rejected=false;
    export function reset(fail=false){calls.length=0;rejected=fail;gate=new Promise(resolve=>releaseLocale=resolve);}
    export const release=()=>releaseLocale();
    export async function resolveLocale(){calls.push('locale');await gate;return 'fr';}
    export async function getThemeTokensSettingCached(){calls.push('theme');if(rejected)throw failure;return tokens;}
    export function buildThemeTokensStyle(value){if(value!==tokens)throw new Error('token identity changed');return ':root{--fixture:stable}';}
    export const THEME_BOOTSTRAP='fixture bootstrap';
    export function GtmLazyLoader(){return null;}
    export function SupabaseHashSessionHandler(){return null;}
    export default function Script(){return null;}
  `;
  try {
    await build({
      stdin: { contents: `export {default as layout} from './frontend/app/layout';export * from 'layout-fixture';`, resolveDir: process.cwd() },
      outfile: join(directory, 'layout.cjs'), bundle: true, platform: 'node', format: 'cjs',
      tsconfig: 'frontend/tsconfig.json', jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PHASE': '""', 'process.env.NEXT_PUBLIC_GTM_ID': '""', 'process.env.GTM_ID': '""' },
      plugins: [{ name: 'layout-boundaries', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          if(args.path==='layout-fixture') return {path:'fixture',namespace:'controlled'};
          if(args.importer===resolve('frontend/app/layout.tsx') && args.path!=='@/server/public-page-timing' && !args.path.startsWith('react')) {
            return {path:args.path.endsWith('.css')?'empty':'fixture',namespace:'controlled'};
          }
        });
        builder.onLoad({filter:/.*/,namespace:'controlled'},args=>({contents:args.path==='empty'?'':fixture,loader:'js'}));
      } }],
    });
    return { harness: createRequire(import.meta.url)(join(directory, 'layout.cjs')), dispose: () => rm(directory, { recursive:true,force:true }) };
  } catch(error) { await rm(directory, {recursive:true,force:true});throw error; }
}

test('root layout times only the existing theme read after locale, preserving HTML and errors', async () => {
  const {harness:h,dispose}=await makeLayoutHarness();
  const priorInfo=console.info;
  const priorSwitch=process.env.CWV_SERVER_TIMING;
  const records: string[]=[];
  console.info=(...args)=>{records.push(args.join(' '));};
  delete process.env.CWV_SERVER_TIMING;
  try {
    h.reset();
    const pending=h.layout({children:'page-content'});
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(h.calls,['locale'],'theme read must not move before locale');
    assert.deepEqual(records,[],'timing must not wrap locale');
    h.release();
    const result=await pending;
    assert.equal(result.type,'html');
    assert.equal(result.props.lang,'fr');
    const [head,body]=result.props.children;
    const style=head.props.children.find((child:any)=>child?.props?.id==='theme-tokens');
    assert.deepEqual(style.props.dangerouslySetInnerHTML,{__html:':root{--fixture:stable}'});
    assert.equal(body.props.children.at(-1),'page-content');
    assert.deepEqual(h.calls,['locale','theme']);
    assert.equal(records.length,1);
    const record=JSON.parse(records[0].slice('[cwv:server] '.length));
    assert.equal(record.route,'root-layout');
    assert.equal(record.locale,'fr');
    assert.equal(record.status,'ok');
    assert.deepEqual(record.phases.map((phase:any)=>[phase.phase,phase.status]),[['theme-tokens','ok']]);
    assert.ok(!records[0].includes('theme-token-values'));

    records.length=0;h.reset(true);
    const rejected=h.layout({children:'page-content'});
    const rejection=assert.rejects(rejected,(error:unknown)=>error===h.failure);
    await new Promise(resolve=>setImmediate(resolve));h.release();await rejection;
    assert.equal(records.length,1);
    assert.equal(JSON.parse(records[0].slice('[cwv:server] '.length)).status,'error');
    assert.ok(!records[0].includes(h.failure.message));

    records.length=0;process.env.CWV_SERVER_TIMING='0';h.reset();
    const disabled=h.layout({children:'page-content'});h.release();
    assert.equal((await disabled).props.lang,'fr');
    assert.deepEqual(h.calls,['locale','theme']);
    assert.deepEqual(records,[]);
  } finally {
    console.info=priorInfo;
    if(priorSwitch===undefined)delete process.env.CWV_SERVER_TIMING;else process.env.CWV_SERVER_TIMING=priorSwitch;
    await dispose();
  }
});
