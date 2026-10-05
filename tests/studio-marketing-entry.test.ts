import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolveStudioMarketingStarter, studioMarketingStarterMessage } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-project-marketing-entry.ts';
import { getStudioMarketingCopy } from '../frontend/app/(localized)/[locale]/(marketing)/studio/_lib/studio-marketing-copy';

test('marketing starter query maps only public guided starters', () => {
  assert.equal(resolveStudioMarketingStarter('product-ad'), 'product-ad');
  assert.equal(resolveStudioMarketingStarter('storyboard-to-video'), 'storyboard-to-video');
  assert.equal(resolveStudioMarketingStarter('cinematic-scene'), 'cinematic-scene');
  assert.equal(resolveStudioMarketingStarter('character-dialogue'), null);
  assert.equal(resolveStudioMarketingStarter(['product-ad']), null);
  assert.equal(resolveStudioMarketingStarter('../admin'), null);
});

test('the product-clip entry is an editable localized brief matching the public example', () => {
  const prices = { en: /exact quote/, fr: /devis exact/, es: /precio exacto/ };
  const approvals = { en: /until I approve/, fr: /sans mon accord/, es: /hasta que lo apruebe/ };
  const messages = new Set<string>();
  for (const locale of ['en', 'fr', 'es'] as const) {
    const message = studioMarketingStarterMessage('product-ad', locale);
    assert.equal(message, getStudioMarketingCopy(locale).brief.body);
    assert.match(message, prices[locale]);
    assert.match(message, approvals[locale]);
    assert.match(message, /clip/);
    messages.add(message);
  }
  assert.equal(messages.size, 3);
  assert.equal(studioMarketingStarterMessage('untrusted', 'es'), '');
  for (const starter of ['storyboard-to-video', 'cinematic-scene']) {
    assert.notEqual(studioMarketingStarterMessage(starter, 'es'), studioMarketingStarterMessage(starter, 'en'));
  }
});

test('Studio draft initialization retains the selected application language before UI fallback', () => {
  const source = readFileSync('frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/StudioImageConversation.client.tsx', 'utf8');
  assert.match(source, /useState\(\(\) => studioMarketingStarterMessage\(starter,\s*appLocale\)\)/);
  assert.doesNotMatch(source, /useState\(\(\) => studioMarketingStarterMessage\(starter,\s*locale\)\)/);
});
