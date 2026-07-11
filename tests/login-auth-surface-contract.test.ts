import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const surfacePath = 'frontend/app/(core)/login/_components/LoginAuthSurface.tsx';
const passwordPath = 'frontend/app/(core)/login/_components/LoginPasswordField.tsx';
const surface = readFileSync(surfacePath, 'utf8');

test('login surface delegates password visibility to a focused component', () => {
  assert.ok(existsSync(passwordPath));
  const password = readFileSync(passwordPath, 'utf8');
  assert.match(surface, /<LoginPasswordField/);
  assert.match(password, /from 'lucide-react'/);
  assert.match(password, /aria-pressed=\{visible\}/);
  assert.match(password, /authCopy\.passwordVisibility/);
  assert.match(password, /autoComplete/);
});

test('login surface owns localized app validation and no native bubbles', () => {
  assert.match(surface, /noValidate/);
  assert.match(surface, /aria-invalid=/);
  assert.match(surface, /aria-describedby=/);
  assert.match(surface, /authCopy\.validation\.formAttention/);
  assert.match(surface, /role="alert"/);
  assert.match(surface, /authCopy\.google/);
  assert.doesNotMatch(surface, />\s*Continue with Google\s*</);
});

test('mode switch is named and duplicate bottom actions are removed', () => {
  assert.match(surface, /role="group"/);
  assert.match(surface, /aria-label=\{authCopy\.modeGroup\}/);
  assert.match(surface, /aria-pressed=\{effectiveMode === 'signin'\}/);
  assert.match(surface, /aria-pressed=\{effectiveMode === 'signup'\}/);
  assert.doesNotMatch(surface, /authCopy\.links\.haveAccount/);
  assert.doesNotMatch(surface, /authCopy\.links\.newAccount/);
  assert.match(surface, /authCopy\.forgotPassword/);
  assert.match(surface, /authCopy\.links\.backToSignIn/);
});

test('mobile density keeps readable controls without clipped overflow', () => {
  assert.match(surface, /p-4 sm:p-6/);
  assert.match(surface, /mb-3[^"\n]*sm:mb-6/);
  assert.doesNotMatch(surface, /overflow-hidden/);
});
