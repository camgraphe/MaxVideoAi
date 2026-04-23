import assert from 'node:assert/strict';
import test from 'node:test';

import { metadata } from '../frontend/app/(core)/login/layout.tsx';

test('login metadata stays explicit and noindexed', () => {
  assert.equal(metadata.title && typeof metadata.title === 'object' ? metadata.title.absolute : undefined, 'MaxVideoAI — Log in');
  assert.equal(metadata.description, 'Create your MaxVideoAI workspace account to generate videos with Sora, Veo, Pika, Kling and more. Sign in, manage credits, and keep every render in one hub.');
  assert.deepEqual(metadata.alternates, { canonical: 'https://maxvideoai.com/login' });
  assert.deepEqual(metadata.robots, { index: false, follow: false });
});
