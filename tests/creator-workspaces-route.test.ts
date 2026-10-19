import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'esbuild';
test('creator route gates new execution, preserves owned recovery entry and keeps finishing release filtering',async()=>{
  const stubs:Record<string,string>={
    'next/navigation':"export const notFound=()=>{throw Error('NOT_FOUND')};",
    '@/content/feature-flags':"export const FEATURES={workflows:{toolsSection:true}};",
    '@/lib/toolbox/finishing':"export const isFinishingToolId=id=>id==='restore-video';export const FINISHING_QUALITY_CHOICES={'restore-video':['fast','best']};",
    '@/server/tools/finishing-providers':"export const FINISHING_PROFILES={'restore-video':{fast:{id:'fast'},best:{id:'best'}}};",
    '@/server/tools/finishing-release':"export const isFinishingProfileReleased=profile=>profile.id==='fast';",
    '@/components/tools/creator/CreatorWorkspace.client':'export default function CreatorWorkspace(){}',
    '@/components/tools/creator/SubtitleWorkspace.client':'export default function SubtitleWorkspace(){}',
    '@/components/tools/FinishingWorkspace':'export default function FinishingWorkspace(){}',
    '@/lib/toolbox/creator-tools':"export const CREATOR_TOOL_IDS=['lip-sync','product-photo-editor','product-video-editor','motion-transfer'];",
    '@/server/tools/creator-availability':'export const isCreatorExecutionEnabled=()=>globalThis.fixtureCreatorEnabled;',
    '@/server/tools/creator-profiles':'export const isCreatorLipVideoEnabled=()=>globalThis.fixtureLipEnabled;export const isCreatorMotionControlEnabled=()=>false;export const listCreatorToolProfiles=()=>[];',
  };
  const bundle=await build({entryPoints:['frontend/app/(core)/(workspace)/app/tools/[toolId]/page.tsx'],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',tsconfig:'frontend/tsconfig.json',packages:'external',plugins:[{name:'route-boundaries',setup(b){b.onResolve({filter:/.*/},a=>a.path in stubs?{path:a.path,namespace:'stub'}:undefined);b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:stubs[a.path],loader:'js'}));}}]});
  const module={exports:{} as any};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(resolve('frontend/package.json')),module,module.exports);
  const page=(id:string,query:Record<string,unknown>={})=>module.exports.default({params:Promise.resolve({toolId:id}),searchParams:Promise.resolve(query)});
  (globalThis as any).fixtureCreatorEnabled=false;(globalThis as any).fixtureLipEnabled=false;
  try{
    for(const tool of ['subtitles','lip-sync','product-photo-editor','product-video-editor','motion-transfer'])await assert.rejects(page(tool),/NOT_FOUND/);
    const doc=await page('subtitles',{document:'captions-1',revision:'3'});assert.equal(doc.type.name,'SubtitleWorkspace');assert.equal(doc.props.executionEnabled,false);assert.deepEqual(doc.props.initialDocument,{id:'captions-1',revision:3});
    const op='12345678-1234-4234-8234-123456789abc',recovery=await page('lip-sync',{operation:op});assert.equal(recovery.props.initialOperationId,op);assert.equal(recovery.props.executionEnabled,false);
    await assert.rejects(page('subtitles',{document:['one','two']}),/NOT_FOUND/);await assert.rejects(page('subtitles',{document:'one',revision:['1']}),/NOT_FOUND/);await assert.rejects(page('lip-sync',{operation:'invalid'}),/NOT_FOUND/);
    const finishing=await page('restore-video');assert.equal(finishing.type.name,'FinishingWorkspace');assert.deepEqual(finishing.props.releasedQualities,['fast']);
    (globalThis as any).fixtureCreatorEnabled=true;(globalThis as any).fixtureLipEnabled=true;
    const mix=await page('subtitles',{project:'project-1',sequence:'sequence-2',sequenceRevision:'7'});assert.deepEqual(mix.props.studioSource,{projectId:'project-1',sequenceId:'sequence-2',expectedRevision:7});
    await assert.rejects(page('subtitles',{project:'project-1',sequenceRevision:'7'}),/NOT_FOUND/);
    const lip=await page('lip-sync');assert.equal(lip.props.executionEnabled,true);assert.equal(lip.props.lipVideoEnabled,true);
  }finally{delete (globalThis as any).fixtureCreatorEnabled;delete (globalThis as any).fixtureLipEnabled;}
});
