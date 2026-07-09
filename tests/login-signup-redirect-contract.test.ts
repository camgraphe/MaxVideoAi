import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const controllerSource = readFileSync(
  'frontend/app/(core)/login/_hooks/useLoginPageController.ts',
  'utf8'
);

function extractBlockBody(source: string, openingBraceIndex: number): string {
  let depth = 0;
  for (let index = openingBraceIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(openingBraceIndex + 1, index);
  }
  assert.fail('expected a balanced block');
}

function extractImmediateSignupSessionBranch(source: string): string {
  const signupStart = source.indexOf('async function signUpWithPassword');
  const signupSource = signupStart >= 0 ? source.slice(signupStart) : source;
  const matches = Array.from(signupSource.matchAll(/if\s*\(\s*data\.session\s*\)\s*\{/g));
  const match = matches.at(-1);
  assert.ok(match?.index != null, 'expected an immediate-signup session branch');
  const openingBraceIndex = match.index + match[0].lastIndexOf('{');
  return extractBlockBody(signupSource, openingBraceIndex);
}

function assertImmediateSignupRedirect(source: string) {
  const immediateSessionBranch = extractImmediateSignupSessionBranch(source);
  assert.doesNotMatch(immediateSessionBranch, /sanitizeNextPath\(\s*['"]\/generate['"]\s*\)/);
  assert.match(immediateSessionBranch, /persistPendingAnalyticsEvent\('sign_up_completed'/);
  assert.match(
    immediateSessionBranch,
    /completeAuthenticatedRedirect\(\s*safeNextPath\s*,\s*data\.session\.user\?\.id/
  );
}

test('immediate password signup preserves the resolved return target', () => {
  assertImmediateSignupRedirect(controllerSource);
});

test('signup redirect contract ignores matching calls outside the immediate-session branch', () => {
  const misleadingSource = `
    persistPendingAnalyticsEvent('sign_up_completed', {});
    completeAuthenticatedRedirect(safeNextPath, data.session.user?.id);
    if (data.session) {
      persistPendingAnalyticsEvent('sign_up_completed', {});
      completeAuthenticatedRedirect(sanitizeNextPath('/generate'), data.session.user?.id);
    }
  `;

  assert.throws(() => assertImmediateSignupRedirect(misleadingSource));
});

test('signup redirect contract tolerates formatting inside the immediate-session branch', () => {
  const formattedSource = `
    if (data.session) {
      persistPendingAnalyticsEvent('sign_up_completed', {});
      completeAuthenticatedRedirect(
        safeNextPath,
        data.session.user?.id
      );
    }
  `;

  assert.doesNotThrow(() => assertImmediateSignupRedirect(formattedSource));
});
