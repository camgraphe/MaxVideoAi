import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rootLayoutSource = readFileSync('frontend/app/layout.tsx', 'utf8');
const handlerSource = readFileSync('frontend/components/auth/SupabaseHashSessionHandler.tsx', 'utf8');

test('root layout consumes Supabase auth hashes on every surface', () => {
  assert.match(
    rootLayoutSource,
    /import \{ SupabaseHashSessionHandler \} from '@\/components\/auth\/SupabaseHashSessionHandler';/
  );
  assert.match(rootLayoutSource, /<SupabaseHashSessionHandler \/>/);
});

test('Supabase hash handler persists sessions and removes tokens from the URL', () => {
  assert.match(handlerSource, /window\.location\.hash/);
  assert.match(handlerSource, /access_token=/);
  assert.match(handlerSource, /refresh_token/);
  assert.match(handlerSource, /supabase\.auth\.setSession/);
  assert.match(handlerSource, /writeLastKnownUserId/);
  assert.match(handlerSource, /window\.history\.replaceState/);
  assert.match(handlerSource, /router\.refresh\(\)/);
});
