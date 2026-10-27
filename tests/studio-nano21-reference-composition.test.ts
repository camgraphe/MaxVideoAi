import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashCanonicalGenerationRequest,
  normalizeGenerationComparisonRequest,
  normalizeGenerationRequest,
  orderedGenerationReferenceRole,
} from '../frontend/src/server/agent-api/generation-normalization';

const references = Array.from({length:14},(_,slot)=>({
  kind:'asset',role:'reference',slot,assetId:'ma_'+(14-slot).toString(16).padStart(32,'0'),
}));
const request = {surface:'image',engineId:'nano-banana-2-1',mode:'i2i',prompt:'Keep the ordered synthetic subjects.',
  settings:{resolution:'2K',thinkingLevel:'HIGH',maxOutputTokens:4096},references};

test('Studio composition preserves all fourteen ordered Nano 2.1 references and native settings',()=>{
  assert.equal(orderedGenerationReferenceRole('i2i','nano-banana-2-1'),'reference');
  const normalized=normalizeGenerationRequest(request);
  assert.deepEqual(normalized.references,references);
  assert.equal(normalized.settings.thinkingLevel,'high');
  assert.equal(normalized.settings.maxOutputTokens,4096);
  assert.deepEqual(normalizeGenerationComparisonRequest(request),normalized);
  const reversed=normalizeGenerationRequest({...request,references:[...references].reverse().map((ref,slot)=>({...ref,slot}))});
  assert.notEqual(hashCanonicalGenerationRequest(normalized),hashCanonicalGenerationRequest(reversed));
});

test('Nano comparison adaptation does not relax canonical purchase reference validation',()=>{
  assert.throws(()=>normalizeGenerationRequest({...request,references:[{...references[0],slot:1},...references.slice(1)]}),/slot/i);
  assert.throws(()=>normalizeGenerationRequest({...request,references:[...references,{...references[0],slot:14,assetId:'ma_'+'f'.repeat(32)}]}),/Nano|scenario/i);
  assert.throws(()=>normalizeGenerationRequest({...request,references:[{kind:'https',role:'reference',mediaKind:'image',url:'https://example.com/synthetic.png'}]}),/Nano|scenario/i);
});
