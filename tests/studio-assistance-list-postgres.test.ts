import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {getDb} from '../frontend/src/lib/db';
import {listStudioAssistanceUnresolved} from '../frontend/src/server/studio/assistance-resolution';
import {startDisposablePostgres} from './helpers/disposable-postgres';

test('support queue pages more than 100 rows with exact filters and stable tie ordering',{timeout:60_000},async t=>{
 const pg=await startDisposablePostgres('support-list'),previous=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
 t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
 for(const file of ['54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
 await pg.pool.query(`INSERT INTO studio_assistance_accounts(user_id,sol_limit_nano_usd,luna_limit_nano_usd) VALUES ('alpha',1,1),('beta',1,1);
 CREATE TEMP TABLE fixture(n int,user_id text,request_id uuid,call_id uuid,lease_id uuid);
 INSERT INTO fixture SELECT n,CASE WHEN n%2=0 THEN 'alpha' ELSE 'beta' END,gen_random_uuid(),gen_random_uuid(),gen_random_uuid() FROM generate_series(1,130) n;
 INSERT INTO studio_assistance_turns(user_id,project_id,request_id,model,mode,policy_version,tariff_version,tariff_snapshot) SELECT user_id,'project',request_id,'gpt-6.1-sol','included_sol','test','test','{}' FROM fixture;
 INSERT INTO studio_assistance_calls(id,user_id,project_id,request_id,lease_id,response_index,model,mode,policy_version,rate_version,tariff_version,state,input_token_bound,output_token_bound,reserved_nano_usd,reserved_cents,created_at)
 SELECT call_id,user_id,'project',request_id,lease_id,0,'gpt-6.1-sol','included_sol','test','test','test',CASE WHEN n IN (126,130) THEN 'reserved' ELSE 'unknown' END,1,1,1,0,CASE WHEN n=130 THEN clock_timestamp() ELSE '2025-01-01 00:00:00.123456+00'::timestamptz END FROM fixture;
 INSERT INTO studio_assistance_resolutions(call_id,action,operator_id,reason,expected_fingerprint) SELECT call_id,'waive_unknown',CASE WHEN n%6=0 THEN 'system:composer-unanswered' ELSE 'support' END,'test',repeat('a',64) FROM fixture WHERE n%3=0;`);
 async function all(opts:{limit:number;userId?:string;waiver?:'all'|'unwaived'|'waived'|'automatic'}){let cursor:string|undefined,rows:any[]=[];do{const page=await listStudioAssistanceUnresolved({...opts,cursor});assert.ok(page.items.length<=opts.limit);rows.push(...page.items);cursor=page.nextCursor??undefined;}while(cursor);return rows;}
 const rows=await all({limit:17});assert.equal(rows.length,129);assert.equal(new Set(rows.map(x=>x.id)).size,129);
 const defaultFirst=await listStudioAssistanceUnresolved();assert.equal(defaultFirst.items.length,100);assert.ok(defaultFirst.nextCursor);
 const defaultLast=await listStudioAssistanceUnresolved({cursor:defaultFirst.nextCursor!});assert.equal(defaultLast.items.length,29);assert.equal(defaultLast.nextCursor,null);
 assert.deepEqual([...defaultFirst.items,...defaultLast.items].map(x=>x.id),rows.map(x=>x.id));
 const expected=(await pg.pool.query(`SELECT c.id FROM studio_assistance_calls c LEFT JOIN studio_assistance_resolutions r ON r.call_id=c.id AND r.action='waive_unknown' WHERE c.state='unknown' OR (c.state='reserved' AND c.created_at<clock_timestamp()-interval '3 minutes') ORDER BY (r.call_id IS NOT NULL),c.created_at,c.id`)).rows.map(x=>x.id);
 assert.deepEqual(rows.map(x=>x.id),expected);
 for(const waiver of ['unwaived','waived','automatic'] as const){const actual=await all({limit:7,userId:'alpha',waiver});const expectedIds=await pg.pool.query(`SELECT c.id FROM studio_assistance_calls c WHERE c.user_id='alpha' AND (c.state='unknown' OR (c.state='reserved' AND c.created_at<clock_timestamp()-interval '3 minutes')) AND ${waiver==='unwaived'?"NOT EXISTS (SELECT 1 FROM studio_assistance_resolutions r WHERE r.call_id=c.id AND r.action='waive_unknown')":waiver==='waived'?"EXISTS (SELECT 1 FROM studio_assistance_resolutions r WHERE r.call_id=c.id AND r.action='waive_unknown')":"EXISTS (SELECT 1 FROM studio_assistance_resolutions r WHERE r.call_id=c.id AND r.action='waive_unknown' AND r.operator_id='system:composer-unanswered')"}`);assert.deepEqual(new Set(actual.map(x=>x.id)),new Set(expectedIds.rows.map(x=>x.id)));}
 await assert.rejects(listStudioAssistanceUnresolved({limit:101}));await assert.rejects(listStudioAssistanceUnresolved({cursor:'invalid'}));
 const first=await listStudioAssistanceUnresolved({limit:5,userId:'alpha'});await assert.rejects(listStudioAssistanceUnresolved({limit:5,userId:'beta',cursor:first.nextCursor!}));
 await assert.rejects(listStudioAssistanceUnresolved({limit:5,userId:'alpha',waiver:'waived',cursor:first.nextCursor!}));
});
