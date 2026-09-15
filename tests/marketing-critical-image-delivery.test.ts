import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharacterReferenceShowcase } from '../frontend/src/components/tools/character-builder/landing/CharacterReferenceShowcase.client';
import { McpStoryVisual } from '../frontend/components/marketing/mcp/McpStoryVisual.client';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('character hero exposes one responsive, high-priority sheet without fetching the alternate portrait', () => {
  const html = renderToStaticMarkup(React.createElement(CharacterReferenceShowcase, {
    sheet: 'Planche', portrait: 'Portrait', views: 'Huit vues', note: 'Illustration',
  }));
  assert.match(html, /fetchPriority="high"/i);
  assert.match(html, /srcSet="[^"]*character-sheet-v1.webp/);
  assert.doesNotMatch(html, /loading="lazy"|character-portrait-v1.webp|<video/);
  assert.equal((html.match(/<img /g) ?? []).length, 1);
  assert.match(html, /character-reference-stage/);
});

test('MCP requests high priority only when used as the route hero', () => {
  const hero = renderToStaticMarkup(React.createElement(McpStoryVisual, { locale: 'fr', priority: true }));
  const secondary = renderToStaticMarkup(React.createElement(McpStoryVisual, { locale: 'fr' }));
  assert.match(hero, /fetchPriority="high"/i);
  assert.doesNotMatch(secondary, /fetchPriority="high"/i);
  assert.match(secondary, /loading="lazy"/);
});
