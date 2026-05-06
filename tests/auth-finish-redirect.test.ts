import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const loginPageSource = readFileSync('frontend/app/(core)/login/page.tsx', 'utf8');
const finishPagePath = 'frontend/app/auth/finish/page.tsx';
const finishClientPath = 'frontend/components/auth/AuthFinishClient.tsx';

test('login redirects through auth finish before opening protected app pages', () => {
  assert.match(
    loginPageSource,
    /buildAuthFinishUrl\(safeTarget\)/,
    'successful login should navigate through a session finalizer before the target page'
  );
  assert.doesNotMatch(
    loginPageSource,
    /window\.location\.assign\(safeTarget\)/,
    'login should not immediately request the target before cookies/session are observable'
  );
});

test('auth finish waits for browser session before replacing to target', () => {
  assert.ok(existsSync(finishPagePath), 'auth finish route should exist');
  assert.ok(existsSync(finishClientPath), 'auth finish client should exist');
  const finishClientSource = readFileSync(finishClientPath, 'utf8');

  assert.match(
    finishClientSource,
    /readBrowserSession\(\)/,
    'auth finish should check the browser Supabase session'
  );
  assert.match(
    finishClientSource,
    /refreshBrowserSession\(\)/,
    'auth finish should retry with a refresh before giving up'
  );
  assert.match(
    finishClientSource,
    /window\.location\.replace\(target\)/,
    'auth finish should replace history with the authenticated target'
  );
  assert.match(
    finishClientSource,
    /window\.location\.replace\(`\/login\?mode=signin&next=\$\{encodeURIComponent\(target\)\}`\)/,
    'auth finish should return to login with next preserved if no session appears'
  );
});
