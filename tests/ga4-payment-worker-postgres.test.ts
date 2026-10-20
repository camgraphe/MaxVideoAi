import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { createQueryExecutor } from '../frontend/src/lib/db';
import { enqueueGa4PaymentEvent } from '../frontend/server/ga4-payment-outbox';
import { drainGa4Payments } from '../frontend/server/ga4-payment-worker';
import { enqueueGa4WalletReceiptSafely, repairGa4WalletIntents } from '../frontend/server/ga4-wallet-events';

test('worker repairs only new consented live receipts and protects terminal intents, roles and consent changes', async(t)=>{
 const pg=await startDisposablePostgres('ga4-worker');t.after(()=>pg.cleanup());const db=createQueryExecutor(pg.pool);
 await pg.pool.query(`CREATE TABLE app_receipts(id bigserial PRIMARY KEY,user_id text,type text,amount_cents integer,currency text,metadata jsonb,stripe_payment_intent_id text,stripe_charge_id text,created_at timestamptz DEFAULT now());
 CREATE TABLE user_roles(user_id text,role text); CREATE TABLE app_admins(user_id text);
 CREATE TABLE user_consents(user_id text,doc_key text,accepted boolean,accepted_at timestamptz);`);
 const metadata={ga4_outbox_version:'1',stripe_livemode:true,analytics_consent:'granted',first_recorded_external_payment:'true',first_wallet_topup:'true',ga_client_id:'123.456',ga_session_id:'1788255901',settlement_amount_cents:2300,settlement_currency:'EUR',ga4_consent_observed_at:new Date(Date.now()-60000).toISOString()};
 await db.query(`INSERT INTO app_receipts(user_id,type,amount_cents,currency,metadata,stripe_payment_intent_id) VALUES ('ordinary','topup',2500,'USD',$1,'pi_fixture')`,[metadata]);
 // Missing outbox schema must not abort the financial transaction; marker survives for repair.
 const client=await pg.pool.connect();
 try {await client.query('BEGIN');assert.equal(await enqueueGa4WalletReceiptSafely(createQueryExecutor(client),'1'),false);await client.query("INSERT INTO app_receipts(user_id,type,amount_cents,metadata) VALUES ('legacy','topup',1000,'{}')");await client.query('COMMIT');}finally{client.release();}
 await pg.pool.query(readFileSync('neon/migrations/76_ga4_payment_outbox.sql','utf8'));
 assert.equal(await repairGa4WalletIntents(db),1);
 assert.equal(await repairGa4WalletIntents(db),0);
 const sent:any[]=[];
 const sender=async(event:any)=>{sent.push(event);return {status:'accepted' as const,code:'http_2xx'};};
 const result=await drainGa4Payments(db,{send:sender}); assert.equal(result.accepted,2);
 assert.deepEqual(sent.map(x=>x.name).sort(),['purchase','topup_completed']);
 for(const e of sent){assert.equal(e.params.value,23);assert.equal(e.params.currency,'EUR');assert.equal(e.params.transaction_id,'pi_fixture');assert.equal(e.params.is_first_recorded_external_payment,true);assert.equal(e.clientId,'123.456');assert.ok(e.timestampMicros);}
 assert.equal(await repairGa4WalletIntents(db),0);
 const cases=[['denied',false,-1000],['regrant',true,1000],['admin',true,-1000]] as const;
 for(const [user,accepted,offset] of cases){
  const observed=new Date();await enqueueGa4PaymentEvent(db,{key:user,userId:user,occurredAt:observed,consentObservedAt:observed,event:{name:'purchase',userId:user}});
  await db.query("INSERT INTO user_consents VALUES ($1,'cookies.analytics',$2,$3)",[user,accepted,new Date(observed.getTime()+offset)]);
 }
 await db.query("INSERT INTO app_admins VALUES ('admin')");
 const protectedRun=await drainGa4Payments(db,{send:sender});assert.equal(protectedRun.suppressed,3);assert.equal(sent.length,2);
 await db.query("UPDATE user_consents SET accepted=true,accepted_at=now() WHERE user_id='denied'");
 assert.equal((await drainGa4Payments(db,{send:sender})).claimed,0);
 // Test mode, denied consent, unknown history and pre-version receipts never enter the queue.
 for(const extra of [{stripe_livemode:false},{analytics_consent:'denied'},{first_recorded_external_payment:'unknown'},{ga4_outbox_version:null}])await db.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency,metadata) VALUES ('excluded','topup',2500,'USD',$1)",[{...metadata,...extra}]);
 assert.equal(await repairGa4WalletIntents(db),0);
});

test('unavailable eligibility never sends, retries are bounded and one failed event does not replay its accepted sibling',async(t)=>{
 const pg=await startDisposablePostgres('ga4-retries');t.after(()=>pg.cleanup());const db=createQueryExecutor(pg.pool);
 await pg.pool.query(readFileSync('neon/migrations/76_ga4_payment_outbox.sql','utf8'));
 await pg.pool.query('CREATE TABLE user_roles(user_id text,role text); CREATE TABLE user_consents(user_id text,doc_key text,accepted boolean,accepted_at timestamptz)');
 for(const name of ['purchase','topup_completed'] as const)await enqueueGa4PaymentEvent(db,{key:name,userId:'fixture',occurredAt:new Date(),consentObservedAt:new Date(),event:{name,userId:'fixture'}});
 let calls=0;const sender=async(e:any)=>{calls++;return e.name==='purchase'?{status:'accepted' as const,code:'http_2xx'}:{status:'retry' as const,code:'network'};};
 let run=await drainGa4Payments(db,{send:sender});assert.equal(run.accepted,1);assert.equal(run.pending,1);
 for(let i=0;i<7;i++){await db.query("UPDATE ga4_payment_outbox SET available_at=now() WHERE status='pending'");run=await drainGa4Payments(db,{send:sender});}
 assert.equal(calls,9);assert.equal(run.dead,1);
 await enqueueGa4PaymentEvent(db,{key:'unknown',userId:'fixture',occurredAt:new Date(),consentObservedAt:new Date(),event:{name:'purchase',userId:'fixture'}});
 await db.query('DROP TABLE user_roles');
 run=await drainGa4Payments(db,{send:sender});assert.equal(run.pending,1);assert.equal(calls,9);
});
