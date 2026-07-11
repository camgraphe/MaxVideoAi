import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const loginFiles = [
  'frontend/app/(core)/login/_hooks/useLoginAuthenticatedRedirect.ts',
  'frontend/app/(core)/login/_hooks/useLoginAuthHashSession.ts',
  'frontend/app/(core)/login/_hooks/useLoginOAuthCodeExchange.ts',
  'frontend/app/(core)/login/_hooks/useLoginPageController.ts',
];

const loginSource = loginFiles
  .map((path) => readFileSync(join(process.cwd(), path), 'utf8'))
  .join('\n');
const authenticatedRedirectSource = readFileSync(
  join(process.cwd(), 'frontend/app/(core)/login/_hooks/useLoginAuthenticatedRedirect.ts'),
  'utf8'
);

test('login defers the full Supabase SDK until session checks or auth actions run', () => {
  assert.doesNotMatch(loginSource, /@\/lib\/supabaseClient['"]/);
  assert.doesNotMatch(loginSource, /from ['"]@supabase\/supabase-js['"]/);
  assert.match(loginSource, /@\/lib\/supabaseClientLoader/);
});

test('the browser client loader keeps the SDK behind a dynamic import', () => {
  const source = readFileSync(join(process.cwd(), 'frontend/src/lib/supabaseClientLoader.ts'), 'utf8');

  assert.match(source, /import\(['"]@\/lib\/supabaseClient['"]\)/);
  assert.doesNotMatch(source, /^import\s+\{[^}]*supabase[^}]*\}\s+from/m);
});

test('guest login visits do not request the SDK before an auth action', () => {
  assert.match(authenticatedRedirectSource, /hasSupabaseAuthCookie/);
  assert.ok(
    authenticatedRedirectSource.match(/if \(!hasSupabaseAuthCookie\(\)\) return;/g)?.length === 2,
    'both existing-session effects should exit before loading Supabase when no auth cookie exists'
  );
});

test('shared browser session cleanup also uses the deferred client', () => {
  const source = readFileSync(
    join(process.cwd(), 'frontend/src/lib/supabase-auth-cleanup.ts'),
    'utf8'
  );

  assert.doesNotMatch(source, /@\/lib\/supabaseClient['"]/);
  assert.match(source, /@\/lib\/supabaseClientLoader/);
});
