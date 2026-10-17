import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { getAudioSubmissionId, clearAudioSubmissionId } from '../frontend/app/(core)/(workspace)/app/audio/_lib/audio-submission-identity';

test('Audio retains an account-bound attempt through retries/reload and releases it for a deliberate new generation', () => {
  const browser = new JSDOM('', { url: 'https://fixture.example/app/audio' });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: browser.window.sessionStorage });
  try {
    const memory = new Map<string, string>();
    const first = getAudioSubmissionId('owner-a', 'input-a', memory);
    assert.equal(getAudioSubmissionId('owner-a', 'input-a', memory), first);
    assert.equal(getAudioSubmissionId('owner-a', 'input-a', new Map()), first, 'reload recovers the unresolved attempt');
    assert.notEqual(getAudioSubmissionId('owner-b', 'input-a', new Map()), first);
    assert.notEqual(getAudioSubmissionId('owner-a', 'input-b', memory), first);
    clearAudioSubmissionId('owner-a', 'input-a', memory);
    assert.notEqual(getAudioSubmissionId('owner-a', 'input-a', memory), first);
    browser.window.sessionStorage.setItem('maxvideoai.audio.submission.v1:owner-a:invalid', '-'.repeat(36));
    assert.match(getAudioSubmissionId('owner-a', 'invalid', memory), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally { browser.window.close(); if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous); else Reflect.deleteProperty(globalThis, 'sessionStorage'); }
});
