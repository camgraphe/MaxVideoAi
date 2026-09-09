import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveStudioMarketingStarter } from '../frontend/app/(core)/(workspace)/app/studio/projects/studio-project-marketing-entry.ts';

test('marketing starter query maps only public guided starters', () => {
  assert.equal(resolveStudioMarketingStarter('product-ad'), 'guided-product-ad');
  assert.equal(resolveStudioMarketingStarter('storyboard-to-video'), 'guided-storyboard-to-video');
  assert.equal(resolveStudioMarketingStarter('cinematic-scene'), 'guided-cinematic-scene');
  assert.equal(resolveStudioMarketingStarter('character-dialogue'), null);
  assert.equal(resolveStudioMarketingStarter(['product-ad']), null);
  assert.equal(resolveStudioMarketingStarter('../admin'), null);
});
