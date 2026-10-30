import assert from 'node:assert/strict';
import test from 'node:test';
import {parseStudioAssistanceSupportArgs,studioAssistanceDatabaseIdentity} from '../frontend/scripts/_lib/studio-assistance-resolution-cli';
const connection='postgresql://operator:never-print-this@db.example.com/product?sslmode=require';
const call='00000000-0000-4000-8000-000000000001';
const base=['--target','db.example.com:5432/product','--environment','production','--call',call,'--action','waive_unknown'];
test('support CLI defaults to dry run and binds an exact non-secret database identity',()=>{
  assert.equal(studioAssistanceDatabaseIdentity(connection),'db.example.com:5432/product');
  assert.equal(parseStudioAssistanceSupportArgs(base,connection).apply,undefined);
  assert.throws(()=>parseStudioAssistanceSupportArgs(base,'postgres://user:secret@other.example.com/product'),/target identity/);
  assert.equal(studioAssistanceDatabaseIdentity('postgresql://postgres@localhost/postgres?host=%2Ftmp%2Ftest-socket'),'/tmp/test-socket:5432/postgres');
});
test('support apply requires a fingerprint, operator and reason; list cannot mutate',()=>{
  assert.throws(()=>parseStudioAssistanceSupportArgs([...base,'--apply','a'.repeat(64)],connection),/operator/);
  const args=[...base,'--apply','a'.repeat(64),'--operator','owner','--reason','Case 123'];
  assert.equal(parseStudioAssistanceSupportArgs(args,connection).apply,'a'.repeat(64));
  assert.throws(()=>parseStudioAssistanceSupportArgs([...args,'--list'],connection),/cannot be combined/);
  assert.throws(()=>parseStudioAssistanceSupportArgs([...args,'--force','true'],connection));
  assert.throws(()=>parseStudioAssistanceSupportArgs([...base,'--action','settle_recorded'],connection),/duplicate/);
});
test('listing accepts bounded pagination and exact filters only in list mode',()=>{
 const list=['--target','db.example.com:5432/product','--environment','production','--list'];
 const parsed=parseStudioAssistanceSupportArgs([...list,'--user','test-user','--waiver','automatic','--limit','25','--cursor','abc'],connection);
 assert.equal(parsed.user,'test-user');assert.equal(parsed.waiver,'automatic');assert.equal(parsed.limit,25);assert.equal(parsed.cursor,'abc');
 for(const extra of [['--limit','0'],['--limit','101'],['--limit','1.5'],['--limit','01'],['--waiver','bad'],['--user',' '],['--cursor','!']])assert.throws(()=>parseStudioAssistanceSupportArgs([...list,...extra],connection));
 assert.throws(()=>parseStudioAssistanceSupportArgs([...base,'--limit','5'],connection),/list/i);
});
test('composer cap diagnostic requires a user and rejects any resolution or list filters',()=>{
  const common=['--target','db.example.com:5432/product','--environment','production'];
  const diagnostic=parseStudioAssistanceSupportArgs([...common,'--diagnose','--user','example-user','--limit','2'],connection);
  assert.equal(diagnostic.diagnose,'true');assert.equal(diagnostic.user,'example-user');assert.equal(diagnostic.limit,2);
  const cursor=Buffer.from(JSON.stringify({v:1,userId:'example-user',id:call})).toString('base64url');
  assert.equal(parseStudioAssistanceSupportArgs([...common,'--diagnose','--user','example-user','--cursor',cursor],connection).cursor,cursor);
  assert.throws(()=>parseStudioAssistanceSupportArgs([...common,'--diagnose'],connection),/user/i);
  assert.throws(()=>parseStudioAssistanceSupportArgs([...common,'--diagnose','--user','example-user','--waiver','all'],connection));
  assert.throws(()=>parseStudioAssistanceSupportArgs([...base,'--diagnose','--user','example-user'],connection));
});
