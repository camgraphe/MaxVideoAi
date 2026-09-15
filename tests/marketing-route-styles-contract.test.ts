import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const marketing = 'frontend/app/(localized)/[locale]/(marketing)/';
test('route-specific editorial CSS is owned by its page, not every marketing request', () => {
  const layout = readFileSync(marketing + 'layout.tsx', 'utf8');
  for (const [style, route] of [
    ['home', '(home)/page.tsx'],
    ['models', 'models/[slug]/page.tsx'],
    ['compare', 'ai-video-engines/[slug]/page.tsx'],
  ]) {
    assert.ok(!layout.includes(`marketing-${style}.css`));
    assert.ok(readFileSync(marketing + route, 'utf8').includes(`import '@/styles/marketing-${style}.css'`));
  }
});
