import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

test('every declared live validation snapshot is an existing, unique source file',()=>{
  const source=readFileSync('scripts/qa/studio-human-live.ts','utf8');
  const manifest=source.match(/for\(const path of \[([\s\S]*?)\]\) \{/);
  assert.ok(manifest,'The live runner must record its source snapshot manifest before dispatch.');
  const paths=[...manifest[1].matchAll(/'((?:frontend|scripts)\/[^']+)'/g)].map(match=>match[1]);
  assert.ok(paths.length>0);
  assert.deepEqual(paths.filter(path=>!existsSync(path)),[],
    'A missing snapshot file aborts live qualification before the first dialogue.');
  assert.equal(new Set(paths).size,paths.length,'Duplicate sources hide provenance inventory mistakes.');
  for(const path of [
    'frontend/src/server/studio/conversation-director.ts',
    'frontend/src/server/studio/image-generation-service.ts',
    'frontend/src/server/studio/audio-generation-service.ts',
    'frontend/src/server/agent-api/audio-capabilities.ts',
    'frontend/src/server/agent-api/prepare-generation.ts',
    'frontend/src/lib/customer-price-presentation.ts',
    'frontend/src/server/studio/conversation-history-facts.ts',
    'frontend/src/server/studio/conversation-audio-discovery.ts',
    'frontend/src/server/agent-api/generation-omni-pricing-facts.ts',
    'frontend/src/server/studio/output-reference-facts.ts',
    'scripts/qa/studio-live-budget.ts',
  ])assert.ok(paths.includes(path),'Missing authoritative source: '+path);
});
