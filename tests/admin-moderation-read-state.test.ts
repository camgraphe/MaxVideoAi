import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModerationTable } from '../frontend/components/admin/ModerationTable';

Object.assign(globalThis, { React });

test('an unavailable moderation read shows an error rather than claiming an empty queue', () => {
  const html = renderToStaticMarkup(React.createElement(ModerationTable, {
    videos: [], initialCursor: null, initialError: 'Unable to load the moderation queue.', embedded: true,
  }));
  assert.match(html, /Unable to load the moderation queue/);
  assert.doesNotMatch(html, /No video items in this moderation bucket/);
});

test('separately finalized tool results are inspectable without publishing their intermediate job', () => {
  for (const canPublish of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(ModerationTable, {
      initialCursor: null, embedded: true, initialSurface: canPublish ? 'video' : 'lip-sync',
      videos: [{ id: 'creator-job', userId: 'owner', engineId: 'wan-3', engineLabel: 'Lip Sync', durationSec: 5,
        prompt: '', createdAt: '2026-10-22T00:00:00Z', status: 'completed', visibility: 'private', indexable: false,
        seoWatch: false, publicationState: 'private', isPublishedOnSite: false, hasLegacyMismatch: false, canPublish }],
    }));
    if (canPublish) assert.match(html, /Publish on site/);
    else {
      assert.doesNotMatch(html, /Publish on site/);
      assert.match(html, /View only/);
    }
  }
});
