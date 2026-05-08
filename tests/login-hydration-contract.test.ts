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
  'frontend/app/(core)/login/_hooks/useLoginPageController.ts',
];
const loginSources = loginPaths.map((path) => readFileSync(join(process.cwd(), path), 'utf8')).join('\n');

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
