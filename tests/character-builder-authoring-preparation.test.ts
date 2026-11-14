import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultCharacterBuilderState } from '../frontend/src/lib/character-builder';
import { buildPrompt } from '../frontend/src/server/tools/character-builder/prompt';
import { buildSettingsSnapshot } from '../frontend/src/server/tools/character-builder/snapshot';
import { sanitizeRequest } from '../frontend/src/server/tools/character-builder/sanitize';

test('the shared Builder preparation keeps its authored recipe, one image and exact format', async () => {
  let module: typeof import('../frontend/src/server/tools/character-builder/preparation');
  try { module = await import('../frontend/src/server/tools/character-builder/preparation'); }
  catch { assert.fail('A shared Character Builder preparation owner is required.'); }
  const base = createDefaultCharacterBuilderState();
  const input = { ...base, userId: 'owner', action: 'generate' as const, qualityMode: 'final' as const,
    formatMode: '4k' as const, advancedNotes: 'Keep the freckle under the left eye', generateCount: 1 };
  const prepared = module.prepareCharacterBuilderRequest(input);
  const sanitized = sanitizeRequest(input);
  const prompt = buildPrompt(sanitized);
  assert.equal(prepared.prompt, prompt);
  assert.equal(prepared.engineId, 'nano-banana-2-1');
  assert.equal(prepared.resolution, '4k');
  assert.equal(prepared.aspectRatio, '4:5');
  assert.equal(prepared.inputMode, 't2i');
  assert.deepEqual(prepared.settingsSnapshot,
    buildSettingsSnapshot(sanitized, prompt, 'nano-banana-2-1', 'Nano Banana 2.1', 't2i'));
  assert.throws(() => module.prepareCharacterBuilderRequest({ ...input, generateCount: 4 }), /one character image/);
});

test('authoring quotes the same unique original images that the workspace sends',async()=>{
  const {prepareCharacterBuilderRequest}=await import('../frontend/src/server/tools/character-builder/preparation');
  const {characterBuilderCanonicalRequest}=await import('../frontend/server/character-studio/authoring-preparation');
  const base=createDefaultCharacterBuilderState();
  const prepared=prepareCharacterBuilderRequest({...base,userId:'owner',action:'generate',generateCount:1,
    referenceImages:[{id:'ma_'+'1'.repeat(32),url:'https://cdn.example/same.png',role:'identity'},
      {id:'ma_'+'2'.repeat(32),url:'https://cdn.example/same.png',role:'style'}]});
  assert.deepEqual(prepared.imageUrls,['https://cdn.example/same.png']);
  assert.deepEqual(characterBuilderCanonicalRequest(prepared).references,[{
    kind:'asset',assetId:'ma_'+'1'.repeat(32),role:'reference',slot:0,
  }]);
});
