import assert from 'node:assert/strict';
import test from 'node:test';
import {parseStudioAssistanceOutputRefundArgs} from '../frontend/scripts/_lib/studio-assistance-output-refund-cli';
const connection='postgresql://operator:never-print-this@db.example.com/product';
const base=['--target','db.example.com:5432/product','--environment','production','--call','00000000-0000-4000-8000-000000000001','--user','fixture-owner'];
test('output refund CLI is exact owned-call, bound-target and read-only by default',()=>{
 assert.equal(parseStudioAssistanceOutputRefundArgs(base,connection).apply,undefined);
 assert.throws(()=>parseStudioAssistanceOutputRefundArgs(base,'postgres://operator:secret@elsewhere.example/product'),/target identity/);
 for(const extra of [['--user','another'],['--amount','180'],['--list','true'],['--force','true']])assert.throws(()=>parseStudioAssistanceOutputRefundArgs([...base,...extra],connection));
 assert.throws(()=>parseStudioAssistanceOutputRefundArgs(base.slice(0,-2),connection));
});
test('output refund apply requires fingerprint, named operator and reason',()=>{
 assert.throws(()=>parseStudioAssistanceOutputRefundArgs([...base,'--apply','a'.repeat(64)],connection),/operator/);
 const options=parseStudioAssistanceOutputRefundArgs([...base,'--apply','a'.repeat(64),'--operator','support-fixture','--reason','Case fixture-123'],connection);
 assert.equal(options.apply,'a'.repeat(64));
 assert.throws(()=>parseStudioAssistanceOutputRefundArgs([...base,'--reason','No reviewed fingerprint'],connection),/fingerprinted/);
 assert.throws(()=>parseStudioAssistanceOutputRefundArgs([...base,'--apply','invalid'],connection));
});

test('local output refund mode refuses remote hosts that merely start with a loopback name',()=>{
 const local=(host:string)=>['--target',host+':5432/product','--environment','local',...base.slice(4)];
 for(const host of ['localhost','127.0.0.1','[::1]'])assert.equal(parseStudioAssistanceOutputRefundArgs(local(host),'postgres://operator@'+host+'/product').environment,'local');
 for(const host of ['localhost.example.com','127.0.0.1.example.com'])assert.throws(()=>parseStudioAssistanceOutputRefundArgs(local(host),'postgres://operator@'+host+'/product'),/loopback/);
});
