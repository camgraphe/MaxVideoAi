import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const loginPageSource = readFileSync(join(process.cwd(), 'frontend/app/(core)/login/page.tsx'), 'utf8');

test('login first render is stable between server and browser hydration', () => {
  assert.doesNotMatch(
    loginPageSource,
    /useState<[^>]+>\(\s*\(\)\s*=>\s*\{[\s\S]*?typeof window/,
    'do not read window/sessionStorage/localStorage from useState initializers used during hydration'
  );
  assert.doesNotMatch(
    loginPageSource,
    /const\s+authRedirectOrigin\s*=[^;]*typeof window/,
    'do not derive auth redirect origin from window during render'
  );
});
