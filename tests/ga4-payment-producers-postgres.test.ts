import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import type Stripe from 'stripe';
import { startDisposablePostgres } from './helpers/disposable-postgres';

// Real producer/transaction/store against PostgreSQL. Only unrelated provisioning,
// preferences and MCP measurement are replaced; no GA collector is called.
test('Stripe producers commit unique recoverable wallet events and distinct refund deltas',async(t)=>{
 const pg=await startDisposablePostgres('ga4-producers'); const folder=mkdtempSync(join(tmpdir(),'ga4-producers-'));
 let producerPool: {end:()=>Promise<void>} | undefined;
 const old=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
 t.after(async()=>{await producerPool?.end();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;rmSync(folder,{recursive:true,force:true});await pg.cleanup();});
 await pg.pool.query(`CREATE TABLE app_receipts(id bigserial PRIMARY KEY,user_id text,type text,amount_cents integer,currency text,description text,metadata jsonb,stripe_payment_intent_id text UNIQUE,stripe_charge_id text,stripe_checkout_session_id text,stripe_invoice_id text,platform_revenue_cents integer,destination_acct text,original_amount_cents integer,original_currency text,fx_rate numeric,fx_margin_bps integer,fx_rate_timestamp timestamptz,stripe_customer_id text,stripe_hosted_invoice_url text,stripe_invoice_pdf text,stripe_receipt_url text,stripe_document_synced_at timestamptz,created_at timestamptz DEFAULT now());`);
 await pg.pool.query(readFileSync('neon/migrations/76_ga4_payment_outbox.sql','utf8'));
 const output=join(folder,'producers.cjs');
 await build({stdin:{contents:`export { recordStripeTopup } from './frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-persistence'; export { handleChargeRefunded } from './frontend/app/api/stripe/webhook/_lib/stripe-webhook-refunds'; export { getDb } from './frontend/src/lib/db';`,resolveDir:process.cwd(),loader:'ts'},outfile:output,bundle:true,platform:'node',format:'cjs',packages:'external',tsconfig:'frontend/tsconfig.json',plugins:[{name:'unrelated-boundaries',setup(b){
  const stubs:Record<string,string>={
   '@/lib/schema':'export async function ensureBillingSchema() {}',
   '@/lib/currency':"export async function ensureUserPreferredCurrency() {} export function normalizeCurrencyCode(v) { return v; }",
   '@/lib/wallet':"export function recordMockWalletTopUp() { throw new Error('unexpected financial fallback'); }",
   '@/server/agent-api/mcp-funnel':'export async function recordConfirmedMcpWalletFunding() {} export function resolveMcpTrialToWalletWindowSeconds() { return 1; }',
  };
  b.onResolve({filter:/^pg$/},()=>({path:createRequire(resolve('frontend/package.json')).resolve('pg'),external:true}));
  b.onResolve({filter:/^@\//},args=>stubs[args.path]?{path:args.path,namespace:'boundary'}:undefined);
  b.onLoad({filter:/.*/,namespace:'boundary'},args=>({contents:stubs[args.path],loader:'ts'}));
 }}]});
 const mod=createRequire(resolve('frontend/package.json'))(output);producerPool=mod.getDb();
 const input={userId:'fixture',stripeLiveMode:true,walletAmountCents:2500,walletCurrency:'USD',settlementAmountCents:2300,settlementCurrency:'EUR',paymentIntentId:'pi_one',metadata:{analytics_consent:'granted',ga_client_id:'123.456',ga4_consent_observed_at:new Date().toISOString()}};
 await Promise.all(Array.from({length:5},()=>mod.recordStripeTopup(input,{receiptsPriceOnly:false})));
 assert.equal((await pg.pool.query('SELECT count(*) FROM app_receipts')).rows[0].count,'1');
 assert.equal((await pg.pool.query('SELECT count(*) FROM ga4_payment_outbox')).rows[0].count,'2');
 await pg.pool.query('ALTER TABLE ga4_payment_outbox RENAME TO ga4_payment_outbox_unavailable');
 await mod.recordStripeTopup({...input,paymentIntentId:'pi_two'},{receiptsPriceOnly:false});
 assert.equal((await pg.pool.query('SELECT count(*) FROM app_receipts')).rows[0].count,'2');
 assert.equal((await pg.pool.query("SELECT metadata->>'ga4_outbox_version' AS version FROM app_receipts WHERE stripe_payment_intent_id='pi_two'")).rows[0].version,'1');
 await pg.pool.query('ALTER TABLE ga4_payment_outbox_unavailable RENAME TO ga4_payment_outbox');
 const refund=(id:string,total:number,previous:number)=>({id,created:Math.floor(Date.now()/1000),data:{previous_attributes:{amount_refunded:previous},object:{id:'ch_fixture',livemode:true,currency:'eur',amount_refunded:total,payment_intent:'pi_one',metadata:{kind:'topup',user_id:'fixture',analytics_consent:'granted',ga_client_id:'123.456',ga4_consent_observed_at:new Date(Date.now()-60000).toISOString()}}}} as unknown as Stripe.Event);
 await Promise.all([mod.handleChargeRefunded(refund('evt_a',500,0),{}),mod.handleChargeRefunded(refund('evt_b',500,0),{})]);
 await mod.handleChargeRefunded(refund('evt_c',1000,500),{});
 const refunds=(await pg.pool.query("SELECT payload->'params'->>'refund_amount_cents' AS delta FROM ga4_payment_outbox WHERE event_name='topup_refunded' ORDER BY event_key")).rows;
 assert.deepEqual(refunds,[{delta:'500'},{delta:'500'}]);
 assert.equal((await pg.pool.query('SELECT count(*) FROM app_receipts')).rows[0].count,'2','refund analytics cannot mutate wallet ledger');
 const legacyRefund=refund('evt_legacy_refund',300,0);
 const legacyCharge=legacyRefund.data.object as Stripe.Charge;
 legacyCharge.id='ch_legacy'; legacyCharge.created=Math.floor(Date.now()/1000)-3600;
 delete legacyCharge.metadata.ga4_consent_observed_at;
 await mod.handleChargeRefunded(legacyRefund,{});
 const [legacyStored]=(await pg.pool.query("SELECT consent_observed_at FROM ga4_payment_outbox WHERE event_key='refund:ch_legacy:300'")).rows;
 assert.equal(legacyStored.consent_observed_at.getTime(),legacyCharge.created*1000,'signed charge creation preserves a legacy granted snapshot');
 await pg.pool.query('ALTER TABLE ga4_payment_outbox RENAME TO ga4_payment_outbox_unavailable');
 await assert.rejects(mod.handleChargeRefunded(refund('evt_retry',1500,1000),{}),/ga4_payment_outbox/,'enqueue failure must reach Stripe event rollback/retry');
});
