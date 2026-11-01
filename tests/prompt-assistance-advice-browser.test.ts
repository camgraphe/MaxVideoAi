import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit,expect} from '@playwright/test';
import {getDb} from '../frontend/src/lib/db';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {createAgentModelCatalogDeps} from '../frontend/src/server/agent-api/model-catalog';
import {getBaseEngines} from '../frontend/src/lib/engines';
import {listAudioCapabilities} from '../frontend/src/server/agent-api/audio-capabilities';
import {buildPromptAssistanceContext} from '../frontend/src/server/prompt-assistance/context';
import {sendPromptAssistance,readPromptAssistance} from './helpers/prompt-assistance-service';
import {readPromptSession} from '../frontend/src/server/prompt-assistance/sessions';
import {chooseStudioAssistance,readStudioAssistanceStatus} from '../frontend/src/server/studio/assistance-ledger';
import {studioAssistancePolicy} from '../frontend/src/server/studio/assistance-policy';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './helpers/disposable-postgres';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {promptAssistanceReloadBrowserSource as videoSource} from './helpers/prompt-assistance-reload-browser-source';

const manual='Keep the manual editor exactly.';
// Optional sealed public reply only; re-routing it is a simulation, not a new model classification.
const nativeReply=process.env.MILO_ADVICE_RECEIPT_PATH?JSON.parse(readFileSync(process.env.MILO_ADVICE_RECEIPT_PATH,'utf8')).reply_json:null;
const plan=nativeReply?[nativeReply.reply,nativeReply.text].filter(Boolean).join('\n\n'):'External editing plan for your real rehearsal footage, 60 seconds.\n00–10: establish the rehearsal room.\n10–50: build rhythm from available shots.\n50–60: end on the performers. Keep the audience outside the frame.';
const visual='One continuous rehearsal shot. A performer enters, places a chair, turns to a partner and bows. The camera slowly moves closer. The audience stays outside the frame.';
const script='Entre estas paredes ensayamos cada día. Entramos, buscamos nuestro lugar y volvemos a empezar.';
const audioSource=`
import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {AudioCreationEditor} from './app/(core)/(workspace)/app/audio/_components/AudioCreationEditor';
import {audioCreationCopy} from './app/(core)/(workspace)/app/audio/_lib/audio-creation-copy';
import {newAudioDraft} from './src/lib/audio-creation';
function Fixture(){const [draft,setDraft]=useState({...newAudioDraft('voice'),script:'${manual}'});
return <main style={{maxWidth:900,margin:'30px auto'}}><p>Local simulated provider, real editor/service. No generation.</p><AudioCreationEditor assistanceAccountId="owner" intent="voice" draft={draft} copy={audioCreationCopy('en')} onChange={patch=>setDraft(current=>({...current,...patch}))} onFile={()=>{throw Error('Upload forbidden');}} uploading={false} onLibrary={()=>{throw Error('Media forbidden');}}/></main>;}
createRoot(document.getElementById('root')).render(<Fixture/>);`;
const config={engine:listFalEngines().find(x=>x.id==='wan-3-prime')!.engine,otherEngine:listFalEngines().find(x=>x.id==='wan-3')!.engine};
const catalog={...createAgentModelCatalogDeps(),listEngines:async()=>getBaseEngines(),isModeExecutable:()=>true,isEngineExecutable:()=>true};
const audio=()=>{const result=listAudioCapabilities();return {...result,modes:result.modes.map(entry=>({...entry,available:true,variants:entry.variants.map(variant=>({...variant,available:true}))}))};};

test('advice remains conversation across restore; real video and Voiceover replacements retain exact apply/Undo', {timeout:120000},async t=>{
 const pg=await startDisposablePostgres('milo-advice-ui'),previous=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
 t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
 await createPaidGenerationTestSchema(pg.pool);
 for(const file of ['54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','85_prompt_assistance.sql','86_milo_three_levels.sql','87_milo_runtime_bounds.sql','92_milo_reply_workers.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
 const policy=studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'});await chooseStudioAssistance('owner',{action:'select_luna',expectedRevision:0},policy);
 const evidence=process.env.MILO_ADVICE_EVIDENCE_DIR,results:unknown[]=[];if(evidence)await mkdir(evidence,{recursive:true});
 for(const surface of ['video','voice'] as const){
  const fixture=await startWorkspaceReferenceFixture({source:surface==='video'?videoSource:audioSource,config,assistanceLive:true});
  try{for(const browserType of [chromium,webkit])await t.test(surface+'/'+browserType.name(),async()=>{
   const browser=await browserType.launch();
   try{
    const page=await browser.newPage({viewport:{width:browserType===webkit?390:1440,height:1000}}),errors:string[]=[],forbidden:string[]=[],requests:any[]=[];let providerCalls=0;
    page.on('pageerror',error=>errors.push(error.message));
    if(surface==='video')await page.addInitScript(manual=>{localStorage.setItem('maxvideoai.generate.form.v1:owner',JSON.stringify({engineId:'wan-3-prime',mode:'t2v',durationSec:6,durationOption:6,resolution:'720p',aspectRatio:'16:9',audio:false}));if(localStorage.getItem('maxvideoai.generate.prompt.v1:owner')===null)localStorage.setItem('maxvideoai.generate.prompt.v1:owner',manual);},manual);
    await page.route('**/*',async route=>{
     const url=new URL(route.request().url());
     if(url.origin!==fixture.url){forbidden.push(route.request().method()+' '+url.origin);return route.abort();}
     if(url.pathname!=='/api/prompt-assistance')return route.continue();
     if(route.request().method()==='GET'){
      const sessionId=url.searchParams.get('sessionId'),requestId=url.searchParams.get('requestId');
      const result=url.searchParams.has('scope')?await readPromptSession('owner',sessionId!,url.searchParams.get('scope')!):requestId?await readPromptAssistance('owner',sessionId!,requestId,policy):await readStudioAssistanceStatus('owner',policy);
      return route.fulfill({json:{ok:true,result}});
     }
     const body=route.request().postDataJSON();assert.equal(body.action,'message');requests.push(body.request);
     const proposed=surface==='video'?visual:script;
     const result=await sendPromptAssistance('owner',body.request,{policy,buildContext:(userId,input)=>buildPromptAssistanceContext(userId,input,{catalog,audio}),count:async()=>100,create:async()=>{
      providerCalls++;const output=providerCalls===1?{kind:'conversation',reply:plan,text:null}:{kind:'replacement',reply:'Here is the text for this editor.',text:proposed};
      return {id:'resp_local_'+body.request.requestId,model:'gpt-6-luna',status:'completed',service_tier:'default',output_text:JSON.stringify(output),usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:100}} as never;
     }});
     assert.equal(result.state,'complete',JSON.stringify(result));return route.fulfill({json:{ok:true,result}});
    });
    await page.goto(fixture.url);
    const editor=surface==='video'?page.locator('[data-workspace-prompt]'):page.locator('#audio-creation-text');
    await expect(editor).toHaveValue(manual);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
    const send=async(message:string)=>{await page.locator('[data-assistance-message]').fill(message);await page.getByRole('button',{name:'Send message to Milo',exact:true}).click();};
    await send('Give me an external editing plan for real rehearsal footage, without generating anything.');
    await expect(page.getByRole('log')).toContainText(plan);await expect(page.locator('[data-assistance-proposal]')).toHaveCount(0);await expect(editor).toHaveValue(manual);
    await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.getByRole('log')).toContainText(plan);
    await expect(page.locator('[data-assistance-proposal]')).toHaveCount(0);await expect(editor).toHaveValue(manual);assert.equal(providerCalls,1,'restore reads JSONB and never calls the provider');
    if(evidence)await page.screenshot({path:evidence+'/'+surface+'-'+browserType.name()+'-advice-restored.png',fullPage:true});
    await send(surface==='video'?'Now write one continuous generated shot: enter, set down a chair, turn and bow.':'Ahora escribe un guion de voz en español para este editor.');
    const proposed=surface==='video'?visual:script;await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
    assert.equal((await page.locator('[data-assistance-proposal]').boundingBox())!.height,53);
    await page.locator('[data-assistance-expand]').click();await expect(page.locator('[data-assistance-editor]')).toHaveValue(proposed);
    await page.locator('[data-assistance-apply]').click();await expect(editor).toHaveValue(proposed);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(editor).toHaveValue(manual);
    await page.getByRole('tab',{name:'Prompt',exact:true}).click();await editor.fill('A later manual edit.');await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
    await expect(page.locator('[data-assistance-apply]')).toBeDisabled();await expect(page.getByRole('button',{name:'Review & use',exact:true})).toHaveCount(0);
    assert.equal(requests.length,2);assert.equal(providerCalls,2);assert.equal(requests[1].draft.target,surface==='video'?'prompt':'script');assert.equal(requests[1].draft.text,manual);
    assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);results.push({surface,browser:browserType.name(),adviceReadableAfterReload:true,adviceProposal:null,applyExact:true,undoExact:true,manualChangeBlocked:true,simulatedProviderCalls:providerCalls});
   }finally{await browser.close();}
  });}finally{await fixture.close();}
 }
 if(evidence)await writeFile(evidence+'/summary.json',JSON.stringify(results,null,2));
});
