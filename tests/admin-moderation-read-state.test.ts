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
