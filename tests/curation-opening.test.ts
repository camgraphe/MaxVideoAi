import assert from 'node:assert/strict';
import test from 'node:test';
import { curationItemFormat, parseCurationDraft, resolveCuration, validateCurationOpening, type CurationItem } from '../frontend/lib/admin/playlist-curation';
const item = (id: string, width: number, height: number, aspectRatio = '16:9'): CurationItem => ({
  id, engineId: 'wan-3', engineLabel: 'Wan 3', prompt: id, thumbUrl: null, videoUrl: '/v.mp4', createdAt: '',
  outputWidth: width, outputHeight: height, aspectRatio,
});
const candidates = [item('a', 1920, 1080), item('b', 480, 854), item('c', 1280, 720), item('d', 1920, 1080), item('e', 1920, 1080)];
const input = { mode: 'manual', orderedIds: ['e', 'a'], excludedIds: [], openingIds: ['a', 'b', 'c', 'd'] };
test('four typed opening slots survive parsing, lead both ordering modes and never duplicate the rest', () => {
  const draft = parseCurationDraft(input);
  assert.deepEqual(draft.openingIds, input.openingIds);
  validateCurationOpening(draft, candidates);
  assert.deepEqual(resolveCuration(draft, candidates).map(item => item.id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(resolveCuration({...draft, mode:'hybrid'}, candidates).map(item => item.id), ['a', 'b', 'c', 'd', 'e']);
});
test('opening rejects partial, duplicate and excluded selections; old drafts keep their behavior', () => {
  for (const openingIds of [['a'], ['a','a','c','d'], ['a','','c','d']]) assert.throws(() => parseCurationDraft({...input, openingIds}));
  assert.throws(() => parseCurationDraft({...input, excludedIds:['b']}), /excluded/);
  const old = parseCurationDraft({mode:'manual', orderedIds:['e','a'], excludedIds:[]});
  assert.deepEqual(resolveCuration(old,candidates).map(item => item.id), ['e','a']);
});
test('measured dimensions take priority over declarations; missing, wrong and unavailable formats fail', () => {
  const draft = parseCurationDraft(input);
  validateCurationOpening(draft,candidates); // b declared landscape, measured portrait
  for (const broken of [candidates.slice(0,3), candidates.map(v => v.id==='b'?item('b',1920,1080,'9:16'):v), candidates.map(v => v.id==='a'?item('a',0,0,'unknown'):v), candidates.map(v => v.id==='c'?item('c',1000,1000):v)]) {
    assert.throws(() => validateCurationOpening(draft,broken), /opening|16:9|9:16|eligible/i);
  }
  validateCurationOpening(draft,candidates.map(v => v.id==='b'?{...v,outputWidth:undefined,outputHeight:undefined,aspectRatio:'9:16'}:v));
});
test('admin opening accepts FLUX codec-rounded output without accepting square media', () => {
  assert.equal(curationItemFormat(item('flux-wide',1280,704)), '16:9');
  assert.equal(curationItemFormat(item('flux-portrait',704,1280,'9:16')), '9:16');
  assert.equal(curationItemFormat(item('square',1024,1024)), null);
});
