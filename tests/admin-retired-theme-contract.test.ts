import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('theme editor is retired without resetting stored theme overrides', () => {
  const page = readFileSync('frontend/app/(core)/admin/theme/page.tsx', 'utf8');
  const api = readFileSync('frontend/app/api/admin/theme-tokens/route.ts', 'utf8');
  const layout = readFileSync('frontend/app/layout.tsx', 'utf8');
  const settings = readFileSync('frontend/src/server/app-settings.ts', 'utf8');
  const homepage = readFileSync('frontend/app/(core)/admin/home/page.tsx', 'utf8');

  assert.match(page, /redirect\('\/admin\/settings'\)/);
  assert.doesNotMatch(homepage, /href="\/admin\/theme"/);
  assert.match(api, /requireAdmin\(req\)/);
  assert.match(api, /status: 410/);
  assert.doesNotMatch(api, /setThemeTokensSetting|EMPTY_THEME_TOKENS/);
  assert.match(layout, /buildThemeTokensStyle/);
  assert.match(settings, /getThemeTokensSetting/);
});
