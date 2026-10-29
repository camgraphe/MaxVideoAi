import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {readStudioConversationProject} from '../frontend/src/server/studio/conversation-run-repository';
import {readStudioConversationExport} from '../frontend/src/server/studio/conversation-export-command';
import {createStudioActionExecutor} from '../frontend/src/server/studio/conversation-actions';
import {createStudioConversationDirector} from '../frontend/src/server/studio/conversation-director';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';

test('Milo sees manual exports and diagnoses an owned render without a quote or private media data',async t=>{
  assert.equal(process.env.DATABASE_URL,undefined,'Only disposable PostgreSQL is allowed.');
  const pg=await startDisposablePostgres('studio-render-facts');
  process.env.DATABASE_URL=pg.databaseUrl+'&options='+encodeURIComponent('-c default_transaction_read_only=on');
  t.after(async()=>{await getDb().end();delete process.env.DATABASE_URL;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  for(const migration of ['26_studio_projects.sql','42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql'])await pg.pool.query(readFileSync('neon/migrations/'+migration,'utf8'));
  await pg.pool.query(`INSERT INTO studio_projects(id,user_id,name,canvas_template_id,settings,workspace_state,persistence_mode)
    VALUES('film','owner','Film','minimal-start','{}','{}','connected'),('other','owner','Other','minimal-start','{}','{}','connected'),('private','foreign','Private','minimal-start','{}','{}','connected');
    INSERT INTO studio_sequences(id,user_id,project_id,name) VALUES('main','owner','film','Main'),('second','owner','film','Second'),('other','owner','other','Other'),('private','foreign','private','Private'),('deleted','owner','film','Deleted');
    UPDATE studio_sequences SET deleted_at=NOW() WHERE id='deleted'`);
  const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'film',clientId:null};
  const renderActor={userId:'owner',authOrigin:'studio-session' as const,clientId:null};
  const dependencies={enabled:true,requestOrigin:'http://localhost:3000'};
  const read=()=>readStudioConversationProject(actor,{exportsEnabled:true});
  const inspect=(input:unknown)=>readStudioConversationExport(renderActor,input,dependencies);
  const id=(character:string)=>'tlx_'+character.repeat(64);
  const quotedId=id('a');
  const manualId=id('b');
  const quoteId=randomUUID();
  const quote={quoteId,exportId:quotedId,projectId:'film',sequenceId:'main',revision:0,durationSec:5,resolution:'720p',aspectRatio:'9:16',fps:30,qualityPreset:'draft',includeAudio:true,price:{amountCents:10,currency:'USD',billingKind:'paid'},expiresAt:'2026-10-28T21:30:00.000Z',confirmationRequired:true};
  await pg.pool.query(`INSERT INTO studio_project_commands(user_id,command_kind,command_version,idempotency_key,request_hash,project_id,sequence_id,request_payload,safe_result)
    VALUES('owner','timeline_export_prepare',1,'quote',$1,'film','main',$2::jsonb,$3::jsonb)`,['0'.repeat(64),JSON.stringify({scope:{authOrigin:'studio-session',clientId:null},request:{idempotencyKey:'quoted-export'},estimateToken:'PRIVATE_ESTIMATE_TOKEN'}),JSON.stringify(quote)]);

  await t.test('missing optional render schema preserves old quote recovery without initializing tables',async()=>{
    const facts=await read();
    assert.deepEqual(facts.exports,[quote]);
    assert.deepEqual(facts.renders,[]);
    assert.equal(await inspect({projectId:'film',quoteId}),null);
    assert.equal((await pg.pool.query("SELECT to_regclass('app_timeline_exports') AS name")).rows[0].name,null);
  });
  // This is intentionally fixture-owned schema setup. The following reads run
  // with default_transaction_read_only enabled, including their real queries.
  await pg.pool.query(`CREATE TABLE app_timeline_exports(id text PRIMARY KEY,user_id text,idempotency_key text,status text,progress int,message text,duration_sec numeric,resolution text,fps int,quality_preset text,amount_cents int,currency text,billing_kind text,billing_status text,render_manifest jsonb,export_settings jsonb,output_url text,output_asset_id text,output_size_bytes bigint,output_mime_type text,created_at timestamptz,updated_at timestamptz,started_at timestamptz,completed_at timestamptz,failed_at timestamptz)`);
  async function insert(exportId:string,userId:string,sequenceId:string,status:string,key=exportId,createdAt='2026-10-28T21:27:46.000Z'){
    await pg.pool.query(`INSERT INTO app_timeline_exports(id,user_id,idempotency_key,status,progress,message,duration_sec,resolution,fps,quality_preset,amount_cents,currency,billing_kind,billing_status,render_manifest,export_settings,output_url,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,'PRIVATE_WORKER_ERROR https://storage.test/private?token=PRIVATE_TOKEN',13.133,'720p',30,'draft',28,'USD','paid',$6,$7::jsonb,$8::jsonb,$9,$10,$10)`,
    [exportId,userId,key,status,status==='completed'?100:0,status==='completed'?'paid_completed':'paid_reserved',JSON.stringify({sequenceId,projectSettings:{aspectRatio:'9:16'},privateMediaUrl:'PRIVATE_SOURCE_URL'}),JSON.stringify({includeAudio:true,estimateToken:'PRIVATE_TOKEN'}),status==='completed'?'https://storage.test/PRIVATE_ARTIFACT_URL':null,createdAt]);
  }
  await insert(quotedId,'owner','main','completed','quoted-export','2026-10-28T21:00:00.000Z');
  await insert(manualId,'owner','second','queued');
  await insert(id('c'),'owner','other','failed');
  await insert(id('d'),'foreign','private','completed');
  await insert(id('e'),'foreign','main','completed');
  await insert(id('f'),'owner','deleted','completed');
  assert.equal((await getDb().query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only,'on');
  await t.test('manual queued and quoted completed exports share safe context with their actual recorded state',async()=>{
    const facts=await read();
    assert.deepEqual(facts.exports,[quote],'Prepared quote cards retain their original contract.');
    const renders=facts.renders!;
    assert.equal(renders.length,2);
    const queued=renders.find(render=>render.id===manualId)!;
    assert.equal(queued.sequenceId,'second');
    assert.equal(queued.status,'queued');
    assert.equal(queued.progress,0);
    assert.equal(queued.startedAt,null);
    assert.equal(queued.createdAt,'2026-10-28T21:27:46.000Z');
    assert.equal(queued.durationSec,13.133);
    assert.equal(queued.aspectRatio,'9:16');
    assert.equal(queued.billingStatus,'paid_reserved');
    assert.deepEqual(queued.billing,{amountCents:28,currency:'USD',billingKind:'paid'});
    assert.equal(renders.find(render=>render.id===quotedId)?.status,'completed');
    assert.doesNotMatch(JSON.stringify(facts),/PRIVATE_|https:|idempotency|render_manifest|export_settings|output_url/i);
    assert.equal((await readStudioConversationProject(actor)).renders,undefined,'Disabled export context remains gated.');
    assert.deepEqual(await inspect({projectId:'film',exportId:manualId}),queued);
    assert.equal((await inspect({projectId:'film',quoteId}))?.id,quotedId,'Historical quote IDs continue to resolve.');
  });
  await t.test('export identity cannot cross account, project, deleted sequence or deleted project boundaries',async()=>{
    for(const exportId of [id('c'),id('d'),id('e'),id('f')])assert.equal(await inspect({projectId:'film',exportId}),null);
    await assert.rejects(readStudioConversationExport({...renderActor,userId:'foreign'},{projectId:'film',exportId:manualId},dependencies));
    await assert.rejects(readStudioConversationExport({...renderActor,authOrigin:'oauth',clientId:'host'},{projectId:'film',exportId:manualId},dependencies),{code:'UNAUTHORIZED'});
    await assert.rejects(inspect({projectId:'film',exportId:manualId,quoteId}));
    await pg.pool.query("UPDATE studio_projects SET deleted_at=NOW() WHERE id='film'");
    await assert.rejects(read());
    await assert.rejects(inspect({projectId:'film',exportId:manualId}));
    await pg.pool.query("UPDATE studio_projects SET deleted_at=NULL WHERE id='film'");
  });
  await t.test('a diagnostic turn uses the manual export ID and remains read-only from project context through tool execution',async()=>{
    let responses=0;
    const execute=createStudioActionExecutor(actor,{enabled:true,editingEnabled:true,exportsEnabled:true,
      prepareImage:async()=>{throw new Error('Diagnosis must not prepare a purchase.');},
      readExport:({quoteId,exportId})=>inspect({projectId:'film',quoteId,exportId}),
    });
    const director=createStudioConversationDirector({editingEnabled:true,exportsEnabled:true,createResponse:async params=>{
      responses++;
      if(responses===1){
        const context=params.input.find(value=>typeof value!=='string'&&'role' in value&&value.role==='developer'&&'content' in value&&typeof value.content==='string'&&value.content.startsWith('Current project facts'));
        assert.ok(context&&typeof context!=='string'&&'content' in context&&typeof context.content==='string');
        const facts=JSON.parse(context.content.slice(context.content.indexOf('{')));
        assert.equal(facts.renders.find((render:{id:string})=>render.id===manualId)?.status,'queued');
        return {id:'inspect-manual',model:'gpt-6.1-sol',status:'completed',usage:null,service_tier:'default',output_text:'',output:[{type:'function_call',name:'export_read',call_id:'manual',arguments:JSON.stringify({exportId:manualId,quoteId:null})}]};
      }
      const output=params.input.find(value=>typeof value!=='string'&&'type' in value&&value.type==='function_call_output');
      assert.ok(output&&typeof output!=='string'&&'output' in output&&typeof output.output==='string');
      const result=JSON.parse(output.output);
      assert.equal(result.ok,true);
      assert.equal(result.data.id,manualId);
      assert.equal(result.data.startedAt,null);
      assert.doesNotMatch(output.output,/PRIVATE_|https:/);
      return {id:'explain-manual',model:'gpt-6.1-sol',status:'completed',usage:null,service_tier:'default',output_text:JSON.stringify({reply:'Your saved export is queued and has not started rendering.'}),output:[]};
    }});
    const reply=await director({message:'Why is my export still rendering at zero?',references:[],history:[],project:await read(),checkpoint:async(_index,create)=>create(),execute:(_callId,action)=>execute(action)});
    assert.match(reply.reply,/queued/);
    assert.equal(responses,2);
    assert.equal((await pg.pool.query('SELECT count(*)::int count FROM app_timeline_exports')).rows[0].count,6);
    assert.equal((await pg.pool.query("SELECT count(*)::int count FROM app_receipts WHERE type='charge'")).rows[0].count,0);
  });
  await t.test('context stays bounded while an exact older export remains inspectable',async()=>{
    for(let index=0;index<9;index++)await insert('tlx_'+index.toString(16).padStart(64,'0'),'owner','main','failed','new-'+index,'2026-10-29T00:00:00.000Z');
    const renders=(await read()).renders!;
    assert.equal(renders.length,8);
    assert.ok(renders.every(render=>render.status==='failed'&&render.message&&!render.message.includes('PRIVATE')));
    assert.equal((await inspect({projectId:'film',exportId:manualId}))?.id,manualId);
  });
});
