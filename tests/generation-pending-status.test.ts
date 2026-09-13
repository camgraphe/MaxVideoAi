import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GenerationPendingStatus, type GenerationPendingStatusProps } from '../frontend/components/groups/GenerationPendingStatus';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import type { Dictionary } from '../frontend/lib/i18n/types';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
function markup(props: GenerationPendingStatusProps) {
  return renderToStaticMarkup(React.createElement(I18nProvider, {
    locale: 'fr', dictionary: {} as Dictionary, fallback: {} as Dictionary,
    children: React.createElement(GenerationPendingStatus, props),
  }));
}

test('pending reader renders observed total, elapsed, overdue and degraded evidence without synthetic percentage', () => {
  const html = markup({ startedAt: Date.now() - 180_000, etaSeconds: 100, etaSource: 'observed', observation: { stage: 'processing', checkedAt: Date.now() - 10_000, degraded: true } });
  for (const copy of ['Traitement en cours', 'Écoulé', 'Moyenne observée', 'Plus long que prévu', 'Vérification indisponible', 'Vérifié il y a']) assert.ok(html.includes(copy), copy);
  assert.doesNotMatch(html, /\d+%|Warming|Stitching/);
  assert.match(html, /aria-live="off"/);
  assert.match(html, /<strong aria-live="polite">Traitement en cours/);
});

test('provider zero is visible; absent ETA and no observation never claim a processing phase', () => {
  assert.match(markup({ observation: { stage: 'queued', providerPercent: { value: 0, source: 'provider', provider: 'fal' } } }), /0%/);
  const unknown = markup({});
  assert.match(unknown, /En attente de statut/);
  assert.doesNotMatch(unknown, /Total estimé|Moyenne observée|Écoulé|%/);
});
