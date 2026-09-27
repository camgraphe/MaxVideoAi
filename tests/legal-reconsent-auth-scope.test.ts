import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const promptSource = readFileSync('frontend/components/legal/ReconsentPrompt.tsx', 'utf8');
const headerBarSource = readFileSync('frontend/components/HeaderBar.tsx', 'utf8');

test('legal reconsent prompt does not call the protected API for anonymous visitors', () => {
  assert.match(promptSource, /readLastKnownUserId/);
  assert.match(promptSource, /hasSupabaseAuthCookie/);
  assert.match(promptSource, /readBrowserSession/);
  assert.match(promptSource, /function resolveReconsentSession/);
  assert.match(promptSource, /if \(!readLastKnownUserId\(\) && !hasSupabaseAuthCookie\(\)\) \{\s*return null;\s*\}/);
  assert.match(promptSource, /session = await resolveReconsentSession\(\)/);
  assert.match(promptSource, /if \(!session\?\.user\) \{\s*commitStatus\(null\);\s*return;/);
});

test('header only enables legal reconsent checks after auth resolution confirms a user', () => {
  assert.match(headerBarSource, /<ReconsentPrompt enabled=\{authResolved && isAuthenticated\} \/>/);
});
