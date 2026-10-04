import OpenAI from 'openai';
import {readFile,writeFile,mkdir,open,unlink,rename} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createStudioConversationDirector,type StudioResponseCreator} from '../../frontend/src/server/studio/conversation-director';
import {createStudioCallRuntime} from './studio-call-runtime';
import {studioTokenCountInput} from '../../frontend/src/server/studio/assistance-token-count';
import {readStudioUsage,studioProviderReservation} from '../../frontend/src/server/studio/assistance-provider-facts';
import {reserveLiveCall,settleLiveCall,type LiveBudget} from './studio-live-budget';
import {parseStudioLiveRequests,readStudioLiveQueue} from './studio-live-queue';
import {listFalEngines} from '../../frontend/src/config/falEngines';
import {listPublicAgentGenerationEngines} from '../../frontend/src/server/agent-api/model-catalog';
import {createStudioImageGenerationService,createStudioVideoGenerationService} from '../../frontend/src/server/studio/image-generation-service';
import {studioVisualCapabilityDetails,studioVisualCapabilitySummary} from '../../frontend/src/server/studio/conversation-capabilities';
import type {StudioConversationProject,StudioActionRequest,StudioActionResult} from '../../frontend/lib/studio/conversation-action-contract';
import type {StudioAssistantModel} from '../../frontend/src/lib/studio/assistance-contract';

type Turn={message:string;reply:string;actions:unknown[];toolProposals?:{name:string;arguments:unknown}[];emittedReplies?:string[];error?:unknown;draft?:unknown;validation?:unknown};
type Journal={budget:LiveBudget;calls:unknown[];cases:Record<string,{model:StudioAssistantModel;project:StudioConversationProject;turns:Turn[]}>};
async function main() {
  const args=process.argv.slice(2);
  const option=(name:string)=>{const index=args.indexOf(name);if(index<0 || !args[index+1]) throw new Error(`Missing ${name}`);return resolve(args[index+1]);};
  if(!args.includes('--live')) throw new Error('Explicit --live required; text API cost only, one authorized cumulative journal cap.');
  const report=option('--journal'),requestsPath=option('--requests'),keyPath=option('--authorized-key-file');
  const validateCalls=args.includes('--prepare-in-isolated-db');
  await mkdir(dirname(report),{recursive:true});
  const lock=await open(report+'.lock','wx');
  try {
    let state:Journal;
    try {state=JSON.parse(await readFile(report,'utf8'));} catch(error) {
      if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error;
      state={budget:{settled:0,held:0,blocked:false},calls:[],cases:{}};
    }
    const save=async()=>{await writeFile(report+'.tmp',JSON.stringify(state,null,2)+'\n',{mode:0o600});await rename(report+'.tmp',report);};
    if(state.budget.blocked || state.budget.held) throw new Error('Unreconciled prior call: no further live dispatch.');
    const capIndex=args.indexOf('--authorized-cap-usd');
    if(capIndex>=0) {
      const capNanoUsd=Number(args[capIndex+1])*1e9;
      if(!Number.isSafeInteger(capNanoUsd)||capNanoUsd<=0||capNanoUsd<state.budget.settled) throw new Error('Invalid authorized cumulative cap');
      state.budget={...state.budget,capNanoUsd};await save();
    }
    // Read only the explicitly authorized credential. Never load database/provider env files.
    const env=await readFile(keyPath,'utf8');
    const match=env.match(/^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(.+)\s*$/m);
    const key=match?.[1]?.trim().replace(/^['"]|['"]$/g,'');
    if(!key) throw new Error('Authorized key unavailable');
    const client=new OpenAI({apiKey:key,baseURL:'https://api.openai.com/v1',maxRetries:0,timeout:65000});
    let requests=parseStudioLiveRequests(await readFile(requestsPath,'utf8'));
    const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',env:{...process.env,GIT_WORK_TREE:process.cwd()}}).trim();
    const sources:Record<string,string>={};
    const toolSchemas=new Set<string>();
    const sourceDirectory=resolve(dirname(report),'source-snapshots');await mkdir(sourceDirectory,{recursive:true});
    for(const path of ['frontend/src/server/studio/conversation-director.ts','frontend/src/server/studio/conversation-director-instructions.ts',
      'frontend/lib/studio/conversation-creation-contract.ts','frontend/lib/studio/conversation-action-contract.ts',
      'frontend/lib/studio/conversation-media-contract.ts','frontend/lib/studio/conversation-pricing-contract.ts',
      'frontend/config/model-registry.json','frontend/config/agent-model-editorial-policy.json',
      'frontend/src/server/studio/assistance-provider-facts.ts','frontend/src/server/studio/image-generation-service.ts',
      'frontend/src/server/agent-api/model-details.ts','frontend/src/server/studio/conversation-capabilities.ts',
      'frontend/src/server/studio/conversation-media-generation.ts','frontend/src/server/studio/image-conversation-service.ts',
      'frontend/src/server/agent-api/generation-actor.ts','scripts/qa/studio-live-budget.ts',
      'scripts/qa/studio-call-runtime.ts','scripts/qa/studio-live-queue.ts','scripts/qa/studio-human-live.ts']) {
      const bytes=await readFile(path);const hash=createHash('sha256').update(bytes).digest('hex');sources[path]=hash;
      await writeFile(resolve(sourceDirectory,hash),bytes,{mode:0o600});
    }
    const entries=listFalEngines();
    const candidates=await listPublicAgentGenerationEngines({
      listEngines:async()=>entries.map(entry=>entry.engine),
      surfaceByEngineId:id=>entries.find(entry=>entry.id===id)?.category==='image'?'image':'video',
      // Runtime readiness is controlled; registry/publication and Studio mode gates remain real.
      isEngineExecutable:()=>true,isModeExecutable:()=>true,
    });
    const actor={authMethod:'studio-session' as const,userId:'synthetic-live-quality',projectId:'synthetic-project',clientId:null};
    const options={enabled:true,prepareDependencies:{listPublicEngines:async()=>candidates}};
    const catalog=[...await createStudioImageGenerationService(actor,options).catalog(),...await createStudioVideoGenerationService(actor,options).catalog()];
    const runtime=validateCalls?await createStudioCallRuntime(candidates,Object.keys(state.cases)):null;
    try {
    for(let requestIndex=0;;requestIndex++) {
      if(requestIndex>=requests.length) {
        if(!args.includes('--adaptive')) break;
        const refreshed=await readStudioLiveQueue(requestsPath,requests,requestIndex);
        requests=refreshed.requests;
        if(refreshed.drained) break;
        if(requestIndex>=requests.length) {
          await new Promise(resolve=>setTimeout(resolve,1000));
          requestIndex--;continue;
        }
      }
      const request=requests[requestIndex];
      if(!request?.id||!request.message||!['gpt-6.1-sol','gpt-6-luna'].includes(request.model)) throw new Error('Invalid adaptive request');
      runtime?.requireCurrentCase(request.id);
      if(state.budget.blocked || state.budget.held) break;
      const current=state.cases[request.id]??={model:request.model,project:{name:'Creative study',revision:0,memory:{revision:0,brief:'',decisions:[]}},turns:[]};
      if(current.model!==request.model) throw new Error('Model switch requires a separate recorded case');
      const turn:Turn={message:request.message,reply:'',actions:[]};
      current.turns.push(turn);
      await save();
      const execute=async(_callId:string,action:StudioActionRequest):Promise<StudioActionResult>=>{
        let result:StudioActionResult;
        if(action.action==='catalog.read') result={ok:true,action:action.action,data:catalog.map(studioVisualCapabilitySummary)};
        else if(action.action==='project.read') result={ok:true,action:action.action,data:current.project};
        else if(action.action==='project.remember') {
          current.project.memory={revision:current.project.memory.revision+1,brief:action.brief,decisions:action.decisions};
          result={ok:true,action:action.action,data:current.project.memory};
        } else if(action.action==='model.details' && catalog.some(c=>c.engine.id===action.modelId)) result={ok:true,action:action.action,data:studioVisualCapabilityDetails(catalog.find(c=>c.engine.id===action.modelId)!)};
        else if(action.action==='media.read') result={ok:true,action:action.action,data:[]};
        else if(action.action==='pricing.read') result={ok:true,action:action.action,data:{modelId:action.modelId,surface:action.surface,mode:action.mode,settings:Object.fromEntries(action.settings.map(s=>[s.name,s.value])),outputCount:1,referenceCount:0,price:{amountCents:action.surface==='image'?18:120,currency:'USD'},estimatedAt:new Date().toISOString(),quoteRequired:true}};
        else result={ok:false,action:action.action,error:{code:'ENGINE_UNAVAILABLE',message:'This isolated quality session cannot prepare, generate, charge, edit, cancel or export. No action was taken.',retryable:false,nextAction:null}};
        turn.actions.push({request:action,result});await save();return result;
      };
      const createResponse:StudioResponseCreator=async original=>{
        const selected={...original,model:request.model,reasoning:{effort:request.model==='gpt-6.1-sol'?'medium' as const:'low' as const}};
        const params=runtime?runtime.responseParams(selected):selected;
        const payloadHash=createHash('sha256').update(JSON.stringify(params)).digest('hex');
        const toolSchemaJson=JSON.stringify(params.tools??[]);
        const toolSchemaHash=createHash('sha256').update(toolSchemaJson).digest('hex');
        if(!toolSchemas.has(toolSchemaHash)) {
          await writeFile(resolve(sourceDirectory,toolSchemaHash),toolSchemaJson,{mode:0o600});
          toolSchemas.add(toolSchemaHash);
        }
        const count=await client.responses.inputTokens.count(studioTokenCountInput(params));
        if(!Number.isSafeInteger(count.input_tokens) || count.input_tokens>272000) throw new Error('Unpriced context size');
        // Reserve the full standard-context ceiling, rather than assuming an exact tokenizer bound.
        state.budget=reserveLiveCall(state.budget,studioProviderReservation(request.model,272000,2200));await save();
        try {
          const response=await client.responses.create(params);
          if(response.output_text)(turn.emittedReplies??=[]).push(response.output_text);
          // Retain emitted tool arguments even if the product parser rejects them.
          // Do not retain the raw response or private reasoning items.
          turn.toolProposals??=[];
          for(const item of response.output)if(item.type==='function_call') {
            let argumentsValue:unknown;
            try{argumentsValue=JSON.parse(item.arguments);}catch{argumentsValue={invalidJson:true,raw:item.arguments};}
            turn.toolProposals.push({name:item.name,arguments:argumentsValue});
          }
          const usage=readStudioUsage(response.usage,response.model,response.service_tier);
          state.budget=settleLiveCall(state.budget,usage?.providerMaxNanoUsd??null);
          state.calls.push({caseId:request.id,turn:current.turns.length,revision,sources,toolSchemaHash,payloadHash,model:response.model,tier:response.service_tier,status:response.status,countedInput:count.input_tokens,usage,at:new Date().toISOString()});
          await save();
          if(state.budget.blocked) throw new Error('Unpriced response; live validation stopped');
          return response;
        } catch(error) {
          // An explicit client rejection is not a generated response. Unknown outcomes keep the reservation.
          const status=(error as {status?:number}).status;
          if(state.budget.held) state.budget=settleLiveCall(state.budget,status && [400,401,403,404,422].includes(status)?0:null);
          state.calls.push({caseId:request.id,toolSchemaHash,payloadHash,error:{status,code:(error as {code?:string}).code??'unknown'},at:new Date().toISOString()});
          await save();throw error;
        }
      };
      const director=createStudioConversationDirector({model:request.model,mediaEnabled:true,editingEnabled:true,exportsEnabled:true,createResponse});
      try {
        if(runtime) {
          const result=await runtime.submit(request.id,request.message,request.referenceKeys??[],createResponse);
          turn.reply=result.result?.reply??'';turn.draft=result.result;turn.error=result.error;
          turn.actions=result.steps;current.project=result.project;
          turn.validation={kind:'actual-preparation-disposable-postgres',quotes:result.quotes,counts:result.counts,
            parity:result.parity,
            availability:'controlled branch catalog, not provider availability',pricing:'real pricing engine with isolated fixture commercial policy'};
        } else {
          const result=await director({message:request.message,references:[],project:current.project,history:current.turns.slice(0,-1).map(t=>({message:t.message,reply:t.reply})) as never,execute,checkpoint:async(_index,create)=>create()});
          turn.reply=result.reply;turn.draft=result;
        }
      } catch(error) {turn.error={status:(error as {status?:number}).status,code:(error as {code?:string}).code??'quality-run-error'};}
      await save();
      console.log(JSON.stringify({id:request.id,model:request.model,turn:current.turns.length,reply:turn.reply,error:turn.error,actions:turn.actions.map(a=>(a as {request:StudioActionRequest}).request.action),costUpperUsd:state.budget.settled/1e9,heldUsd:state.budget.held/1e9,blocked:state.budget.blocked}));
    }
    } finally {await runtime?.close();}
  } finally {await lock.close();await unlink(report+'.lock');}
}
main().catch(()=>{console.error('Live QA stopped. Inspect the safe journal; no key or raw provider error is printed.');process.exitCode=1;});
