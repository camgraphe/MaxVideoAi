import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveStudioMarketingStarter } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-project-marketing-entry.ts';

test('marketing starter query maps only public guided starters', () => {
  assert.equal(resolveStudioMarketingStarter('product-ad'), 'product-ad');
  assert.equal(resolveStudioMarketingStarter('storyboard-to-video'), 'storyboard-to-video');
  assert.equal(resolveStudioMarketingStarter('cinematic-scene'), 'cinematic-scene');
  assert.equal(resolveStudioMarketingStarter('character-dialogue'), null);
  assert.equal(resolveStudioMarketingStarter(['product-ad']), null);
  assert.equal(resolveStudioMarketingStarter('../admin'), null);
});
