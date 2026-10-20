import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EngineScoreLabel } from '../frontend/src/components/ui/engine-select/EngineScoreLabel';
import { getBenchmarkScoreReviewCopy } from '../frontend/lib/benchmark-score-review';

test('workspace score label exposes localized editorial provenance only for estimated scores', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getBenchmarkScoreReviewCopy(locale);
    const html = renderToStaticMarkup(React.createElement(EngineScoreLabel, {
      scoreLabel: '8.7', label: 'Score', locale, reviewStatus: 'editorial-estimated',
    }));
    assert.match(html, /8\.7\/10/);
    assert.ok(html.includes(copy.short));
    assert.ok(html.includes(copy.label));
    assert.ok(html.includes(copy.fallback));
    const established = renderToStaticMarkup(React.createElement(EngineScoreLabel, { scoreLabel: '8.7', label: 'Score', locale }));
    assert.match(established, /8\.7\/10/);
    assert.ok(!established.includes(copy.label));
  }
});
