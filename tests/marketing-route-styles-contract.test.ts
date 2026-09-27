import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const marketing = 'frontend/app/(localized)/[locale]/(marketing)/';
test('route-specific editorial CSS is owned by its server route, not every marketing request', () => {
  const layout = readFileSync(marketing + 'layout.tsx', 'utf8');
  for (const [style, route] of [
    ['home', '(home)/page.tsx'],
    ['models', 'models/[slug]/page.tsx'],
    ['compare', 'ai-video-engines/[slug]/page.tsx'],
    ['tools', 'tools/layout.tsx'],
  ]) {
    assert.ok(!layout.includes(`marketing-${style}.css`), `${style} styles must not block unrelated marketing routes`);
    const routeSource = readFileSync(marketing + route, 'utf8');
    assert.ok(routeSource.includes(`import '@/styles/marketing-${style}.css'`), `${style} styles must be a static route import for the first server render`);
    assert.doesNotMatch(routeSource, /^\s*['"]use client['"]/);
  }
});

test('English tools compose the same server style owner as localized tools', () => {
  const defaultLayout = readFileSync('frontend/app/tools/layout.tsx', 'utf8');
  assert.match(
    defaultLayout,
    /import ToolsLayout from ['"]\.\.\/\(localized\)\/\[locale\]\/\(marketing\)\/tools\/layout['"]/,
    'the English route must enter the same tools layout that owns the prerendered stylesheet',
  );
  assert.match(defaultLayout, /<ToolsLayout>\{children\}<\/ToolsLayout>/);
  assert.doesNotMatch(defaultLayout, /^\s*['"]use client['"]/);
});
