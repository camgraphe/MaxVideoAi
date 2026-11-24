import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { createImageConversationService } from '../frontend/src/server/studio/image-conversation-service';
import { createStudioImageGenerationService } from '../frontend/src/server/studio/image-generation-service';
import { studioTaskFixture } from './helpers/studio-task-fixture';

test('a Studio model choice resumes its offered edit and keeps the quote tied to its actual photo', async t => {
  const fixture = await studioTaskFixture(t);
  const environment = {NODE_ENV:process.env.NODE_ENV, PRICING_SANDBOX:process.env.PRICING_SANDBOX};
  Object.assign(process.env, {NODE_ENV:'development', PRICING_SANDBOX:'1'});
  t.after(() => {
    for (const [key,value] of Object.entries(environment)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const actor = await fixture.actor();
  const {pool} = fixture;
  for (const name of ['27_pricing_admin_cockpit.sql','54_customer_tariff_cells.sql','55_customer_tariff_versions.sql'])
    await pool.query(readFileSync('neon/migrations/' + name, 'utf8'));
  await pool.query(`UPDATE app_customer_tariff_state SET active=true, revision=1;
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,status text,kind text,url text);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text)`);
  const photo1 = 'ma_' + 'a'.repeat(32), photo2 = 'ma_' + 'b'.repeat(32);
  for (const id of [photo1,photo2]) await pool.query(
    "INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata) VALUES($1,$1,$2,'image',$3,'image/png',1024,200,200,'ready','{}')",
    [id,actor.userId,'https://cdn.maxvideoai.com/' + id + '.png']);
  const modelId = 'seedream-5-0-flash';
  const entry = getFalEngineById(modelId)!;
  const comparison = 'Seedream 5.0 Flash, GPT Image 2.6 Flare ou Nano Banana Pro. Lequel souhaitez-vous que je prépare ?';
  const message = (message: string, references: string[] = [], labels: string[] = []) => ({
    requestId:randomUUID(),locale:'fr' as const,message,references,
    ...(references.length ? {referenceMentions:references.map((assetId,i) => ({assetId,label:labels[i]}))} : {}),
  });
  const observed: string[][] = [];
  const open = (context = actor) => createImageConversationService(context, {
    enabled:true,
    generationFactory:(a,options) => createStudioImageGenerationService(a,{...options,prepareDependencies:{
      listPublicEngines:async () => [{engine:entry.engine,surface:'image',publicModes:['t2i','i2i'],
        modeCaps:Object.fromEntries(entry.modes.map(mode => [mode.mode,mode.ui]))}],
      resolveRequestExecutability:() => ({executable:true,reason:'available'}),
    }}),
    director:async (input,_history,refs) => {
      observed.push(refs.map(ref => ref.assetId));
      if (input.message === 'Voici ma photo.') return {reply:'Souhaitez-vous que je prépare cette retouche pour votre photo ?',image:null};
      if (input.message === 'Oui') return {reply:comparison,image:null};
      if (input.message.includes('pour plus tard')) return {reply:'Je garde cette photo pour plus tard.',image:null};
      if (!refs.length) return {reply:'Je ne peux pas préparer le devis. Veuillez joindre la photo à nouveau.',image:null};
      return {reply:'Préparons la retouche.',image:{modelId,mode:'i2i',prompt:'Give the original boat a midnight-blue background.',aspectRatio:'1:1',settings:[{name:'resolution',value:'1K'}]}};
    },
  });
  const first = message('Voici ma photo.',[photo1],['Image 1']);
  await open().submit(first);
  const yes = await open().submit(message('Oui'));
  assert.deepEqual(observed.at(-1),[photo1]);
  assert.equal(yes.quote,null);
  // Reopen the old project after the broken server saved an empty answer to this choice.
  const old = message('Seedream');
  await pool.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,draft_json,draft_reference_fingerprint,lease_id,lease_expires_at,state)
    VALUES($1,$2,$3,$4,$5,$6,$4,$7,now(),'ready')`, [actor.userId,actor.projectId,old.requestId,'a'.repeat(64),old,
    {reply:'Je ne peux pas préparer le devis. Veuillez joindre la photo à nouveau.',image:null},randomUUID()]);
  await open().submit(message('Cette autre photo est pour plus tard.',[photo2],['Image 2']));
  const select = message('Seedream 5.0 Flash');
  const selected = await open().submit(select);
  const change = await open().submit(message('Non, plutôt Image 2.'));
  const both = await open().submit(message('Utilise les deux.'));
  for (const [turn,refs,source] of [[selected,[photo1],'Image 1'],[change,[photo2],'Image 2'],[both,[photo1,photo2],'Image 1 et Image 2']] as const) {
    assert.equal(turn.quote?.summary.engineId,modelId);
    assert.equal(turn.quote.summary.mode,'i2i');
    assert.deepEqual(turn.quote.summary.references.map(r=>r.assetId).sort(),[...refs].sort());
    assert.equal(turn.quote.price.amountCents,3);
    assert.ok(turn.reply?.includes('Retouche avec Seedream 5.0 Flash à partir d’' + source));
    assert.match(turn.reply,/0,03\s*\$US/);
    assert.deepEqual(turn.references,[]);
    const reopened=(await open().read()).turns.find(saved=>saved.requestId===turn.requestId);
    assert.equal(reopened?.reply,turn.reply);
    assert.equal(reopened?.quote?.quoteId,turn.quote.quoteId);
  }
  assert.equal((await open().submit(select)).quote?.quoteId,selected.quote?.quoteId);
  assert.notEqual(change.quote?.quoteId,selected.quote?.quoteId);
  // Use an independent old project for each boundary, keeping the same account and available assets.
  async function scenario(assets: string[], reply: string, choice: string, intervening?: string, anotherPhoto = false) {
    const projectId = randomUUID(), source = message('Une retouche de ma photo.', assets, assets.map((_,i) => 'Image ' + (i+1)));
    await pool.query('INSERT INTO studio_projects(id,user_id,name) VALUES($1,$2,$3)',[projectId,actor.userId,'Photos']);
    const insert = (turn: ReturnType<typeof message>, answer: string, minutes: number) => pool.query(
      `INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,draft_json,draft_reference_fingerprint,lease_id,lease_expires_at,state,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$4,$7,now(),'ready',now()-interval '2 days'+$8*interval '1 minute')`,
      [actor.userId,projectId,turn.requestId,'a'.repeat(64),turn,{reply:answer,image:null},randomUUID(),minutes]);
    await insert(source,reply,0);
    if (intervening) await insert(anotherPhoto ? message(intervening,[photo2],['Image 2']) : message(intervening),'Compris.',1);
    const before = observed.length;
    const result = await open({...actor,projectId}).submit(message(choice));
    return {result, seen:observed.slice(before)};
  }
  for (const [offer,choice] of [[comparison,'Je choisis Seedream, merci.'],
    ['Seedream 5.0 Flash or Nano Banana Pro. Which should I prepare?', 'Go with Seedream'],
    ['Seedream 5.0 Flash o Nano Banana Pro. ¿Cuál prefieres?', 'Elijo Seedream'],
    ['Souhaitez-vous que je prépare cette retouche pour votre photo ?', 'Oui, prépare-la.']]) {
    assert.deepEqual((await scenario([photo1],offer,choice)).seen,[[photo1]]);
  }
  const ambiguous = await scenario([photo1,photo2],comparison,'Seedream');
  assert.equal(ambiguous.result.quote,null);
  assert.deepEqual(ambiguous.seen,[]);
  assert.match(ambiguous.result.reply!,/Image 1 ou Image 2/);
  const intervening = await scenario([photo1],comparison,'Seedream','Voici une autre photo.',true);
  assert.deepEqual(intervening.seen,[]);
  assert.match(intervening.result.reply!,/Image 1 ou Image 2/);
  for (const [offer,choice,intervening] of [[comparison,'Seedream','Ignore Image 1.'],
    [comparison,'Seedream','Parlons maintenant de musique.'],
    ['Voici les spécifications de Seedream.','Seedream'],
    [comparison,'Quel est le prix de Seedream ?'],[comparison,'Veo']]) {
    assert.deepEqual((await scenario([photo1],offer,choice,intervening)).seen,[[]]);
  }
  await pool.query('UPDATE media_assets SET deleted_at=now() WHERE public_id=$1',[photo1]);
  const missing = await scenario([photo1],comparison,'Seedream');
  assert.deepEqual(missing.seen,[]);
  assert.equal(missing.result.quote,null);
  assert.match(missing.result.reply!,/ne peux pas lire/);
  assert.equal((await pool.query('SELECT count(*)::int n FROM app_jobs')).rows[0].n,0);
  assert.equal((await pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
});
