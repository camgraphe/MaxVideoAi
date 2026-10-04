import test from 'node:test';import assert from 'node:assert/strict';
import {publicationCiState} from '../frontend/src/server/editorial/publication-ci';
test('publication waits for actual CI and deployment checks and never treats skipped checks as success',()=>{
 assert.equal(publicationCiState([],[]),'pending');
 const ci=[{name:'Quality CI',status:'completed',conclusion:'success'}],vercel=[{context:'Vercel',state:'success'}];
 assert.equal(publicationCiState(ci,vercel),'passed');
 assert.equal(publicationCiState(ci,[]),'pending');
 assert.equal(publicationCiState([{...ci[0],conclusion:'skipped'}],vercel),'failed');
 assert.equal(publicationCiState([...ci,{name:'Other required check',status:'completed',conclusion:'failure'}],vercel),'failed');
 assert.equal(publicationCiState(ci,[{context:'Vercel',state:'pending'}]),'pending');
});

test('a confirmed merge conflict or exhausted polling budget is actionable instead of starving the queue',()=>{
 const ci=[{name:'Quality CI',status:'completed',conclusion:'success'}],vercel=[{context:'Vercel',state:'success'}];
 assert.equal(publicationCiState(ci,vercel,{mergeable:false,polls:1}),'failed');
 assert.equal(publicationCiState([],[],{mergeable:null,polls:37}),'failed');
 assert.equal(publicationCiState(ci,vercel,{mergeable:null,polls:1}),'pending');
});
