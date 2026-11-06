import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {NextRequest} from 'next/server';
import {startDisposablePostgres} from './helpers/disposable-postgres';
import {getDb,query} from '../frontend/src/lib/db';
import {handleStudioCharacters} from '../frontend/app/api/studio/_lib/studio-character-handler';
import {createCharacterStudioIntegration} from '../frontend/server/character-studio/integration';

test('Studio character search is partial, literal, paginated and owner-scoped while name stays exact',async t=>{
  const pg=await startDisposablePostgres('studio-character-search');
  const previous=process.env.DATABASE_URL;
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
  const owner='00000000-0000-4000-8000-000000000091',other='00000000-0000-4000-8000-000000000092';
  await pg.pool.query('CREATE TABLE profiles(id uuid PRIMARY KEY);CREATE TABLE studio_projects(id text PRIMARY KEY,user_id uuid,name text,deleted_at timestamptz)');
  await pg.pool.query('INSERT INTO profiles VALUES($1),($2)',[owner,other]);
  await pg.pool.query("INSERT INTO studio_projects VALUES('film',$1,'Character film',NULL),('other-film',$2,'Another film',NULL)",[owner,other]);
  await pg.pool.query(readFileSync('neon/migrations/93_character_studio.sql','utf8'));
  async function add(name:string,userId=owner) {
    const id=name+'-'+userId;
    await pg.pool.query(`INSERT INTO character_studio_characters(user_id,name,source_job_id,image_url,thumb_url,settings_snapshot)
      VALUES($1,$2,$3,'https://media.maxvideoai.com/original.png','https://media.maxvideoai.com/thumb.webp','{}')`,[userId,name,id]);
  }
  await add('Dixie Trouble');
  for(let i=0;i<13;i++)await add('Dixie look '+i);
  await add('Literal %_ character');
  for(let i=0;i<13;i++)await add('New unrelated '+i);
  await add('Dixie Foreign',other);
  const readOnlyUrl=new URL(pg.databaseUrl);
  readOnlyUrl.searchParams.set('options','-c default_transaction_read_only=on');
  process.env.DATABASE_URL=readOnlyUrl.toString();
  assert.equal((await query<{setting:string}>("SELECT current_setting('default_transaction_read_only') AS setting"))[0].setting,'on');
  const exact=createCharacterStudioIntegration({authMethod:'oauth',clientId:'test-client',userId:owner,emailVerified:true},{executionEnabled:false});
  async function route(params:Record<string,string>,projectId='film',userId=owner) {
    return handleStudioCharacters(new NextRequest('http://localhost:4320/api/studio/projects/'+projectId+'/characters?'+new URLSearchParams(params)),projectId,'read',
      {enabled:true,resolveAccess:async()=>({ok:true,userId})});
  }
  async function list(params:Record<string,string>) {
    const response=await route(params);assert.equal(response.status,200);return (await response.json()).result;
  }
  await t.test('a partial query finds older names before pagination and keeps disjoint pages',async()=>{
    const first=await list({search:' dIxIe '});
    assert.equal(first.characters.length,12);
    assert.ok(first.characters.every((item:{name:string})=>item.name.startsWith('Dixie')));
    const second=await list({search:'Dixie',cursor:first.nextCursor});
    assert.equal(second.characters.length,2);assert.equal(second.nextCursor,null);
    const names=[...first.characters,...second.characters].map((item:{name:string})=>item.name);
    assert.equal(new Set(names).size,14);assert.ok(names.includes('Dixie Trouble'));assert.ok(!names.includes('Dixie Foreign'));
    assert.deepEqual((await list({search:'Trou'})).characters.map((item:{name:string})=>item.name),['Dixie Trouble']);
  });
  await t.test('percent and underscore are literal characters rather than SQL wildcards',async()=>{
    assert.deepEqual((await list({search:'%_'})).characters.map((item:{name:string})=>item.name),['Literal %_ character']);
  });
  await t.test('exact name semantics remain available to the shared service and route',async()=>{
    assert.deepEqual((await exact.list({name:'Dixie'})).characters,[]);
    assert.deepEqual((await exact.list({name:'dIxIe TrOuBlE'})).characters.map(item=>item.name),['Dixie Trouble']);
    assert.deepEqual((await list({name:'Dixie'})).characters,[]);
  });
  await t.test('project access, owner isolation and input bounds stay enforced',async()=>{
    assert.equal((await route({search:'Dixie'},'other-film')).status,404);
    const foreign=await route({search:'Dixie'},'other-film',other);
    assert.deepEqual((await foreign.json()).result.characters.map((item:{name:string})=>item.name),['Dixie Foreign']);
    assert.equal((await route({search:'a'.repeat(81)})).status,400);
    assert.equal((await route({search:'   '})).status,400);
  });
});
