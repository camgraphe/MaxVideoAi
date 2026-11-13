import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';

test('actual handoff route revalidates exact asset ownership and availability with no cookie',async()=>{
  const root=resolve('frontend');
  const base='https://mcp-route-fixture.s3.eu-central-1.amazonaws.com';
  const assetId='ma_11111111111111111111111111111111';
  const row={id:'internal',public_id:assetId,user_id:'owner',kind:'video',url:`${base}/renders/owner/video.mp4`,
    mime_type:'video/mp4',status:'ready',metadata:{},deleted_at:null,hidden:false};
  const state={row:row as typeof row|null,queries:[] as Array<{sql:string;values:string[]}>};
  const built=await build({absWorkingDir:root,stdin:{contents:"export {GET,HEAD} from './app/api/mcp/media/route'; export {createMcpMediaLink} from './src/server/mcp/media-link';",resolveDir:root,loader:'ts'},
    tsconfig:resolve(root,'tsconfig.json'),bundle:true,platform:'node',format:'cjs',write:false,packages:'external',plugins:[{name:'read-only-media-db',setup(builder){
      builder.onResolve({filter:/^@\/lib\/db$/},()=>({path:'db',namespace:'fixture'}));
      builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export async function query(sql,values){state.queries.push({sql,values}); if(!sql.includes("FROM media_assets"))throw Error("Unexpected query"); return state.row?[state.row]:[];} export function withDbTransaction(){throw Error("Unexpected write");}',loader:'js'}));
    }}]});
  const module={exports:{} as any};
  runInNewContext(built.outputFiles[0].text,{module,exports:module.exports,require:createRequire(resolve(root,'package.json')),state,
    process:{env:{S3_BUCKET:'mcp-route-fixture',S3_REGION:'eu-central-1',S3_PUBLIC_BASE_URL:base,S3_ACCESS_KEY_ID:'offline',S3_SECRET_ACCESS_KEY:'offline',MCP_ACQUISITION_SIGNING_SECRET:'offline-route-key-with-at-least-32-bytes'}},
    URL,Request,Response,Buffer,console,AbortSignal});
  const {GET,HEAD,createMcpMediaLink}=module.exports;
  const link=createMcpMediaLink({principal:{userId:'owner',clientId:'client',authMethod:'oauth',emailVerified:true},
    origin:'https://openai-review.maxvideoai.com',source:{type:'asset',assetId,kind:'video'},url:row.url});
  assert.ok(link);
  for(const method of ['GET','HEAD']) {
    const response=await (method==='GET'?GET:HEAD)(new Request(`${link}&utm_source=chatgpt.com`,{method}));
    assert.equal(response.status,307);
    const target=new URL(response.headers.get('Location'));
    assert.equal(target.pathname,'/renders/owner/video.mp4');assert.equal(target.searchParams.has('utm_source'),false);
  }
  assert.equal(state.queries.length,2);
  assert.deepEqual(Array.from(state.queries[0].values),['owner',assetId,'video']);
  assert.match(state.queries[0].sql,/a\.user_id = \$1/);
  for(const replacement of [null,{...row,user_id:'foreign'},{...row,public_id:'different'},
    {...row,status:'deleted'},{...row,hidden:true},{...row,url:`${base}/renders/foreign/video.mp4`},
    {...row,url:`${base}/renders/owner/replacement.mp4`}]) {
    state.row=replacement;
    const response=await GET(new Request(link));
    assert.equal(response.status,404);assert.equal(response.headers.has('Location'),false);
  }
});
