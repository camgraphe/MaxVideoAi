import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('frontend/src/lib/supabaseClient.ts', 'utf8');

test('browser Supabase client does not auto-exchange OAuth query codes', () => {
  assert.doesNotMatch(
    source,
    /createBrowserClient/,
    '@supabase/ssr createBrowserClient forces detectSessionInUrl in the browser and races the login page PKCE exchange'
  );
  assert.match(source, /createClient\(supabaseUrl,\s*supabaseKey,/);
  assert.match(source, /detectSessionInUrl:\s*false/);
  assert.match(source, /flowType:\s*['"]pkce['"]/);
});

test('browser Supabase client keeps SSR cookie storage', () => {
  assert.match(source, /createStorageFromOptions/);
  assert.match(source, /cookieEncoding:\s*['"]base64url['"]/);
  assert.match(source, /storage,/);
});
