import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './helpers/disposable-postgres';
import {studioAssistancePolicy} from '../frontend/src/server/studio/assistance-policy';
import * as ledger from '../frontend/src/server/studio/assistance-ledger';

test('Lite, Standard and Max share credits, freeze requests and preserve paused purchases',async t=>{
 const pg=await startDisposablePostgres('milo-levels'),old=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
 t.after(async()=>{await getDb().end();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;await pg.cleanup();});
 await createPaidGenerationTestSchema(pg.pool);
 for(const file of ['54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','86_milo_three_levels.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
 const policy=studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'}),actor={userId:'owner',projectId:'film',authMethod:'studio-session' as const,clientId:null};
 let status=await ledger.readStudioAssistanceStatus('owner',policy);
 const oldRequest=randomUUID();await ledger.openStudioAssistanceTurn(actor,oldRequest,policy);
 status=await ledger.chooseStudioAssistance('owner',{action:'select_terra',expectedRevision:status.revision},policy);
 assert.equal(status.selectedModel,'gpt-6.1-terra');assert.equal(status.tariff.outputUsdPerMillion,10);
 assert.equal((await ledger.openStudioAssistanceTurn(actor,oldRequest,policy)).model,'gpt-6.1-sol');
 await assert.rejects(ledger.chooseStudioAssistance('owner',{action:'select_sol',expectedRevision:0},policy),/settings changed/);
 async function run(output:number){const requestId=randomUUID();const turn=await ledger.openStudioAssistanceTurn(actor,requestId,policy);const call=await ledger.reserveStudioAssistanceCall({...actor,requestId,leaseId:randomUUID(),index:0,inputTokens:1000,outputTokens:2200},policy);const evidence={id:randomUUID(),model:turn.model,service_tier:'default',usage:{input_tokens:1000,input_tokens_details:{cached_tokens:0},output_tokens:output}};assert.equal(await ledger.settleStudioAssistanceCall(call.id,'owner',evidence),true);assert.equal(await ledger.settleStudioAssistanceCall(call.id,'owner',evidence),true);return ledger.readStudioAssistanceStatus('owner',policy);}
 status=await run(1000);assert.equal(status.credits?.included.remaining,480);assert.equal(status.credits?.included.reserved,0);
 status=await ledger.chooseStudioAssistance('owner',{action:'select_luna',expectedRevision:status.revision},policy);status=await run(1000);assert.equal(status.credits?.included.remaining,480);
 status=await ledger.chooseStudioAssistance('owner',{action:'select_sol',expectedRevision:status.revision},policy);status=await run(1000);assert.equal(status.credits?.included.remaining,450);
 await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES('owner','topup',1000,'USD')");
 status=await ledger.chooseStudioAssistance('owner',{action:'select_terra',expectedRevision:status.revision},policy);
 const purchase={action:'purchase_pack' as const,amountCents:200 as const,tariffVersion:status.tariff.version,expectedRevision:status.revision,purchaseKey:randomUUID()};
 status=await ledger.chooseStudioAssistance('owner',purchase,policy);await ledger.chooseStudioAssistance('owner',purchase,policy);
 assert.equal(status.selectedModel,'gpt-6.1-terra');assert.equal(status.credits?.purchased.total,2000);
 status=await ledger.chooseStudioAssistance('owner',{action:'disable_paid',expectedRevision:status.revision},policy);
 for(const action of ['select_luna','select_sol','select_terra'] as const){status=await ledger.chooseStudioAssistance('owner',{action,expectedRevision:status.revision},policy);assert.equal(status.paid.enabled,false);assert.equal(status.credits?.purchased.remaining,2000);}
 status=await run(1000);assert.equal(status.credits?.included.remaining,430);assert.equal(status.credits?.purchased.remaining,2000);
 const charges=(await pg.pool.query("SELECT amount_cents,pricing_snapshot FROM app_receipts WHERE type='charge'")).rows;
 assert.equal(charges.length,1);assert.equal(charges[0].amount_cents,200);assert.equal(charges[0].pricing_snapshot.tariff.outputUsdPerMillion,10);
 await assert.rejects(ledger.chooseStudioAssistance('owner',{action:'select_terra',expectedRevision:status.revision},{...policy,credits:false}),/shared credit policy/);
});
