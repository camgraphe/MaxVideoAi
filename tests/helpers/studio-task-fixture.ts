import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {getDb} from '../../frontend/src/lib/db';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './disposable-postgres';
import {studioAssistancePolicy} from '../../frontend/src/server/studio/assistance-policy';
import {STUDIO_TASK_POLICY_VERSION,STUDIO_TASK_PROFILES,type StudioTaskProfile} from '../../frontend/src/lib/studio/task-budget-contract';

export async function studioTaskFixture(t:{after:(fn:()=>Promise<void>)=>void}) {
  const pg=await startDisposablePostgres('studio-task'),previous=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,deleted_at timestamptz);
    CREATE TABLE studio_sequences(id text PRIMARY KEY);`);
  for(const file of ['50_studio_image_conversation.sql','51_studio_image_model_usage.sql','42_studio_connected_montages.sql','52_studio_conversation_runs.sql','54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','65_studio_task_budgets.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
  const policy=studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'});
  async function actor() {
    const id=randomUUID();await pg.pool.query("INSERT INTO studio_projects(id,user_id,name,persistence_mode) VALUES($1,$1,'Creative task','connected')",[id]);
    return {authMethod:'studio-session' as const,userId:id,projectId:id,clientId:null};
  }
  function input(profile:StudioTaskProfile='standard',message='Create the requested film') {
    return {requestId:randomUUID(),message,references:[],taskBudget:{profile,maxCredits:STUDIO_TASK_PROFILES[profile].maxCredits,policyVersion:STUDIO_TASK_POLICY_VERSION,...(profile==='complex'?{confirmedComplex:true as const}:{})}};
  }
  return {...pg,policy,actor,input};
}
