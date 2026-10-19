import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {startDisposablePostgres} from './helpers/disposable-postgres';
import {createSubtitleRepository,type SubtitleRepositoryDependencies} from '../frontend/src/server/subtitles/repository';
import {normalizeScribeTranscript} from '../frontend/src/lib/subtitles/document';

test('owned subtitle revisions are atomic, immutable and idempotent under concurrent corrections',async t=>{
  const pg=await startDisposablePostgres('subtitles-doc');t.after(()=>pg.cleanup());
  await pg.pool.query(readFileSync('neon/migrations/70_subtitle_documents.sql','utf8'));
  const dependencies:SubtitleRepositoryDependencies={
    query:async(sql,params)=>(await pg.pool.query(sql,params)).rows,
    transaction:async run=>{const client=await pg.pool.connect();try{await client.query('BEGIN');const result=await run({query:async(sql,params)=>(await client.query(sql,params)).rows});await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}},
  };
  const repository=createSubtitleRepository(dependencies);
  const doc=normalizeScribeTranscript({text:'original',language_code:'eng',words:[{text:'original',type:'word',start:0,end:1}]},{id:'sub-1',source:{ref:{type:'asset',assetId:'owned',kind:'video'},fingerprint:'a'.repeat(64),durationMs:2000}});
  await repository.create('owner',doc,'transcription-job');
  assert.deepEqual(await repository.create('owner',doc,'transcription-job'),doc,'creation replay must survive PostgreSQL JSONB key ordering');
  assert.equal((await repository.read('owner','sub-1'))?.revision,1);assert.equal(await repository.read('stranger','sub-1'),null);
  const patch=(text:string)=>({segments:[{...doc.segments[0],text}]});
  const outcomes=await Promise.allSettled([repository.update('owner','sub-1',1,'request-one',patch('first')),repository.update('owner','sub-1',1,'request-two',patch('second'))]);
  assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);assert.equal(outcomes.filter(result=>result.status==='rejected').length,1);
  const winner=outcomes[0].status==='fulfilled'?'first':'second',requestId=winner==='first'?'request-one':'request-two';
  const latest=await repository.read('owner','sub-1');assert.equal(latest?.revision,2);assert.equal(latest?.segments[0].text,winner);
  const replay=await repository.update('owner','sub-1',1,requestId,patch(winner));assert.equal(replay.revision,2);
  await assert.rejects(repository.update('owner','sub-1',1,requestId,patch('different')),/REQUEST_CONFLICT/);
  await assert.rejects(repository.update('stranger','sub-1',2,'foreign',patch('attack')),/NOT_FOUND/);
  assert.equal((await repository.read('owner','sub-1',1))?.segments[0].text,'original');
  assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM subtitle_document_revisions')).rows[0].n,2);
  await pg.pool.query('SET default_transaction_read_only=on');assert.equal((await repository.read('owner','sub-1'))?.revision,2);
});
