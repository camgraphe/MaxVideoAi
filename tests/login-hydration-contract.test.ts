import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const loginPaths = [
  'frontend/app/(core)/login/page.tsx',
  'frontend/app/(core)/login/_hooks/useLoginAutofillSync.ts',
  'frontend/app/(core)/login/_hooks/useLoginBrowserLocale.ts',
  'frontend/app/(core)/login/_hooks/useLoginModeFromQuery.ts',
  'frontend/app/(core)/login/_hooks/useLoginNextTarget.ts',
  'frontend/app/(core)/login/_hooks/useLoginAuthenticatedRedirect.ts',
  'frontend/app/(core)/login/_hooks/useLoginAuthHashSession.ts',
  'frontend/app/(core)/login/_hooks/useLoginOAuthCodeExchange.ts',
  'frontend/app/(core)/login/_hooks/useLoginPageController.ts',
];
const loginSources = loginPaths.map((path) => readFileSync(join(process.cwd(), path), 'utf8')).join('\n');
const authHashSessionSource = readFileSync(
  join(process.cwd(), 'frontend/app/(core)/login/_hooks/useLoginAuthHashSession.ts'),
  'utf8'
);

test('login first render is stable between server and browser hydration', () => {
  assert.doesNotMatch(
    loginSources,
    /useState<[^>]+>\(\s*\(\)\s*=>\s*\{[\s\S]*?typeof window/,
    'do not read window/sessionStorage/localStorage from useState initializers used during hydration'
  );
  assert.doesNotMatch(
    loginSources,
    /const\s+authRedirectOrigin\s*=[^;]*typeof window/,
    'do not derive auth redirect origin from window during render'
  );
});

test('hash-session failures clear pending Google intent without changing successful analytics', () => {
  assert.match(
    authHashSessionSource,
    /import \{[\s\S]*clearPendingGoogleLogin[\s\S]*\} from '\.\.\/_lib\/login-helpers'/
  );
  assert.match(
    authHashSessionSource,
    /if \(!accessToken \|\| !refreshToken\) \{[\s\S]*?clearPendingGoogleLogin\(\);[\s\S]*?replaceState/
  );
  assert.match(
    authHashSessionSource,
    /if \(error\) \{[\s\S]*?clearPendingGoogleLogin\(\);[\s\S]*?setError\(error\.message/
  );
  assert.match(
    authHashSessionSource,
    /if \(!data\.session\) \{\s*clearPendingGoogleLogin\(\);\s*return;\s*\}/
  );
  assert.match(
    authHashSessionSource,
    /\.catch\(\(err\) => \{[\s\S]*?clearPendingGoogleLogin\(\);[\s\S]*?setError\(/
  );

  const successStart = authHashSessionSource.indexOf('const userId = data.session.user?.id ?? null;');
  const successEnd = authHashSessionSource.indexOf('.catch((err)', successStart);
  assert.ok(successStart >= 0 && successEnd > successStart, 'expected the successful setSession continuation');
  const successContinuation = authHashSessionSource.slice(successStart, successEnd);
  assert.doesNotMatch(successContinuation, /clearPendingGoogleLogin\(\)/);
  assert.match(
    successContinuation,
    /consumePendingGoogleLogin\(\)[\s\S]*persistPendingAnalyticsEvent\(eventName/
  );
});
