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
