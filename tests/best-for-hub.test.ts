import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const bestForHubSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/page.tsx',
  'utf8',
);

test('best-for hub does not include the starter questionnaire CTA block', () => {
  assert.doesNotMatch(bestForHubSource, /Not sure where to start\?/);
  assert.doesNotMatch(bestForHubSource, /Find my engine/);
  assert.doesNotMatch(bestForHubSource, /Vous ne savez pas par où commencer/);
  assert.doesNotMatch(bestForHubSource, /Trouver mon moteur/);
});
