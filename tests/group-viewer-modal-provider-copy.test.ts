import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Dictionary } from '../frontend/lib/i18n/types';
import type { VideoGroup } from '../frontend/types/video-groups';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const source = readFileSync('frontend/components/groups/GroupViewerModal.tsx', 'utf8');

test('group viewer modal does not expose internal provider labels', () => {
  assert.doesNotMatch(source, /label:\s*'Provider'/);
  assert.doesNotMatch(source, /Live \(fal\)/);
});

test('group viewer carries honest pending provenance and timing into the lightbox', async () => {
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  const [{ GroupViewerModal }, { I18nProvider }] = await Promise.all([
    import('../frontend/components/groups/GroupViewerModal'),
    import('../frontend/lib/i18n/I18nProvider'),
  ]);
  const now = Date.now();
  const group: VideoGroup = {
    id: 'pending-group',
    layout: 'x1',
    provider: 'fal',
    status: 'loading',
    createdAt: new Date(now - 120_000).toISOString(),
    paramsSnapshot: { engineLabel: 'Seedance 2.5' },
    items: [{
      id: 'pending-item',
      jobId: 'job-pending',
      url: '',
      aspect: '16:9',
      meta: {
        status: 'pending',
        progress: 90,
        observation: {
          stage: 'processing',
          providerPercent: { value: 0, source: 'provider', provider: 'fal' },
          checkedAt: now - 8_000,
          degraded: true,
        },
        startedAt: now - 120_000,
        etaSeconds: 75,
        etaSource: 'observed',
      },
    }],
  };
  let html: string;
  try {
    html = renderToStaticMarkup(React.createElement(I18nProvider, {
      locale: 'fr',
      dictionary: {} as Dictionary,
      fallback: {} as Dictionary,
      children: React.createElement(GroupViewerModal, { group, onClose() {} }),
    }));
  } finally {
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader;
    else delete require.extensions['.css'];
  }

  assert.doesNotMatch(html, /90%/);
  assert.match(html, /0%/);
  for (const copy of ['Traitement en cours', 'Écoulé', 'Moyenne observée', 'Vérification indisponible', 'Vérifié il y a']) {
    assert.ok(html.includes(copy), copy);
  }
  assert.doesNotMatch(html, /Preview unavailable|Media will be available once the render completes/);
});
