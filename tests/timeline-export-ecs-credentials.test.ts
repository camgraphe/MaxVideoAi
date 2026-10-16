import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';

const frontend=resolve('frontend');
const environment=()=>({NODE_ENV:'production',TIMELINE_EXPORT_ECS_CLUSTER:'offline-cluster',TIMELINE_EXPORT_ECS_TASK_DEFINITION:'offline-worker:1',TIMELINE_EXPORT_ECS_SUBNETS:'subnet-offline',TIMELINE_EXPORT_ECS_SECURITY_GROUP:'sg-offline',TIMELINE_EXPORT_ECS_REGION:'us-east-1',TIMELINE_EXPORT_ESTIMATE_SECRET:'offline-estimate-secret-with-at-least-32-bytes'});

async function load(env:NodeJS.ProcessEnv){
  const fixture={clients:[] as any[],commands:[] as any[],reservations:0};
  const stubs:Record<string,string>={
    'server-only':'',
    '@aws-sdk/client-ecs':`export class ECSClient {constructor(config){fixture.clients.push(config);}async send(command){fixture.commands.push(command.input);return {tasks:[{taskArn:'offline-task'}]};}}export class RunTaskCommand {constructor(input){this.input=input;}}`,
    '@/lib/db':'export const query=()=>{throw Error("Unexpected database call");};export const withDbTransaction=query;',
    '@/server/timeline-exports/manifest-resolver':'export const resolveOwnedTimelineExportRequest=async input=>input.request;',
    '@/server/timeline-exports/billing':'export const createTimelineExportJobWithReservation=async()=>{fixture.reservations++;throw Error("UNEXPECTED_RESERVATION");};export const releaseFailedTimelineExportBilling=()=>{throw Error("Unexpected refund");};',
    '@/server/timeline-exports/repository':'export const readTimelineExportJobByIdempotencyKey=async()=>null;export const countUsedFreeTimelineExports=()=>{throw Error("Unexpected quota read");};export const readTimelineExportJob=countUsedFreeTimelineExports;export const failTimelineExportJob=countUsedFreeTimelineExports;',
    '@/server/timeline-exports/media-access':'export const ownedTimelineExportJobResponse=()=>{throw Error("Unexpected projection");};',
  };
  const result=await build({absWorkingDir:frontend,
    stdin:{contents:"export * from './src/server/timeline-exports/ecs-runner';export {submitOwnedTimelineExport} from './src/server/timeline-exports/orchestration';",resolveDir:frontend,loader:'ts'},
    tsconfig:resolve(frontend,'tsconfig.json'),bundle:true,platform:'node',format:'cjs',write:false,packages:'external',
    plugins:[{name:'offline-ecs-credentials',setup(builder){
      builder.onResolve({filter:/.*/},args=>args.path in stubs?{path:args.path,namespace:'fixture'}:undefined);
      builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'js',resolveDir:frontend}));
    }}],
  });
  const module={exports:{} as any};
  runInNewContext(result.outputFiles[0].text,{module,exports:module.exports,fixture,require:createRequire(resolve(frontend,'package.json')),process:{env},Buffer});
  return {runner:module.exports,fixture};
}

test('ECS launch binds the dedicated credential pair without changing default AWS credentials',async()=>{
  const env={...environment(),AWS_ACCESS_KEY_ID:'legacy-key',AWS_SECRET_ACCESS_KEY:'legacy-secret',TIMELINE_EXPORT_ECS_ACCESS_KEY_ID:' dedicated-key ',TIMELINE_EXPORT_ECS_SECRET_ACCESS_KEY:' dedicated-secret '};
  const before=JSON.stringify(env);
  const {runner,fixture}=await load(env);
  const launched=await runner.launchTimelineExportWorkerTask({exportId:'offline-export'});
  assert.equal(fixture.clients[0].region,'us-east-1');
  assert.equal(fixture.clients[0].credentials?.accessKeyId,'dedicated-key');
  assert.equal(fixture.clients[0].credentials?.secretAccessKey,'dedicated-secret');
  assert.equal(fixture.commands.length,1);
  assert.equal(fixture.commands[0].overrides.containerOverrides[0].environment[0].value,'offline-export');
  assert.equal(launched.status,'launched');assert.equal(launched.taskArns[0],'offline-task');
  assert.equal(JSON.stringify(env),before,'Launcher configuration cannot rewrite shared AWS credentials.');
});

test('ECS launch retains the AWS default credential chain when neither dedicated key is configured',async()=>{
  for(const overrides of [{},{TIMELINE_EXPORT_ECS_ACCESS_KEY_ID:' ',TIMELINE_EXPORT_ECS_SECRET_ACCESS_KEY:' '}]){
    const {runner,fixture}=await load({...environment(),AWS_ACCESS_KEY_ID:'legacy-key',AWS_SECRET_ACCESS_KEY:'legacy-secret',...overrides});
    await runner.launchTimelineExportWorkerTask({exportId:'offline-export'});
    assert.equal(Object.hasOwn(fixture.clients[0],'credentials'),false,'Omitting the pair must leave SDK default-chain resolution intact.');
    assert.equal(fixture.commands.length,1);
  }
});

const incompletePairs=[
  {env:{TIMELINE_EXPORT_ECS_ACCESS_KEY_ID:'dedicated-key'},missing:'TIMELINE_EXPORT_ECS_SECRET_ACCESS_KEY'},
  {env:{TIMELINE_EXPORT_ECS_SECRET_ACCESS_KEY:'dedicated-secret',TIMELINE_EXPORT_ECS_ACCESS_KEY_ID:' '},missing:'TIMELINE_EXPORT_ECS_ACCESS_KEY_ID'},
];
test('half-configured dedicated credentials fail preflight and launch before constructing an ECS client',async()=>{
  for(const {env,missing} of incompletePairs){
    const {runner,fixture}=await load({...environment(),...env});
    assert.throws(()=>runner.assertTimelineExportWorkerLauncherConfigured(),new RegExp('MISSING_'+missing));
    await assert.rejects(runner.launchTimelineExportWorkerTask({exportId:'offline-export'}),new RegExp('MISSING_'+missing));
    assert.equal(fixture.clients.length,0);assert.equal(fixture.commands.length,0);
  }
});

test('half-configured credentials stop canonical submission before free quota or wallet reservation',async()=>{
  const rawRequest={version:1,source:'maxvideoai-editor',projectId:'offline-project',idempotencyKey:'offline-export-key',createdAt:'2026-10-11T00:00:00.000Z',status:'ready',
    manifest:{version:1,source:'maxvideoai-editor',projectName:'Offline film',sequenceId:'main',sequenceName:'Main',createdAt:'2026-10-11T00:00:00.000Z',status:'ready',durationSec:5,issues:[],exportRange:{mode:'sequence',startSec:0,endSec:5,durationSec:5},
      tracks:[{id:'video',durationSec:5,clips:[{id:'clip',assetId:'asset',outputNodeId:'output',title:'Clip',track:'video',mediaKind:'video',mediaUrl:'https://cdn.maxvideoai.com/offline.mp4',startSec:0,endSec:5,durationSec:5,sourceStartSec:0,sourceEndSec:5}]}]},
    exportSettings:{format:'mp4-h264',qualityPreset:'standard',includeAudio:true,serverRenderMode:'server'}};
  for(const {env,missing} of incompletePairs){
    const {runner,fixture}=await load({...environment(),...env});
    const submitted=await runner.submitOwnedTimelineExport({userId:'offline-owner',requestOrigin:'https://maxvideoai.com',rawRequest,estimateToken:'present'});
    assert.equal(submitted.status,503);
    assert.equal(submitted.body.error,'TIMELINE_EXPORT_WORKER_NOT_CONFIGURED');
    assert.equal(submitted.body.message,'MISSING_'+missing);
    assert.equal(fixture.reservations,0);assert.equal(fixture.clients.length,0);
  }
});
