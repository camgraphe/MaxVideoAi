import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBytePlusMarketingImport } from '../frontend/server/marketing-media/byteplus/contract';
import { byteplusFixture, digest, evidenceFile } from './helpers/byteplus-marketing-fixture';

test('BytePlus adoption binds the real request, one accepted task and completed receipt for all five modes', () => {
  for (const mode of ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']) {
    const input = byteplusFixture(mode);
    const result = parseBytePlusMarketingImport(input);
    assert.equal(result.input.mode, mode);
    assert.equal(result.request.model, 'dreamina-seedance-2-5-flash-261115');
    assert.equal(result.result.id, 'cgt-20261116000000-fixture');
    assert.equal(result.receipt.output.bytes, 16);
  }
});

test('tampering, wrong owner, mixed tasks and duplicate submission cannot be adopted', () => {
  for (const change of [
    (value: any) => { value.evidence.request.utf8 += ' '; },
    (value: any) => { value.ownerUserId = '22222222-2222-4222-8222-222222222222'; },
    (value: any) => { value.providerTaskId = 'cgt-different'; },
    (value: any) => { value.videoSha256 = 'f'.repeat(64); },
    (value: any) => { value.mode = 'i2v'; },
    (value: any) => { value.evidence.journal.utf8 += value.evidence.journal.utf8.split('\n')[0] + '\n'; value.evidence.journal.sha256 = digest(value.evidence.journal.utf8); },
    (value: any) => { const receipt = JSON.parse(value.evidence.receipt.utf8); receipt.nativeAppJobId = 'already-native'; value.evidence.receipt = evidenceFile(receipt); },
  ]) {
    const value = byteplusFixture(); change(value);
    assert.throws(() => parseBytePlusMarketingImport(value), /BYTEPLUS_IMPORT/);
  }
});

test('every reference occurrence needs its exact content slot; no credentials or fabricated price fields accepted', () => {
  const value = byteplusFixture('ref2v');
  value.references = [];
  assert.throws(() => parseBytePlusMarketingImport(value), /BYTEPLUS_IMPORT/);
  assert.throws(() => parseBytePlusMarketingImport({ ...byteplusFixture(), finalPriceCents: 200 }), /BYTEPLUS_IMPORT/);
});
