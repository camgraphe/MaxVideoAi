import './helpers/server-view-styles';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import publication from '../frontend/config/mcp-publication.json';
import { parseMarkdownFile } from '../frontend/lib/content/markdown';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { readModelDecisionInput } from './helpers/model-decision-content';
import { buildModelDecisionData } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data';
import { BestForContent } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_components/BestForEditorialPanels';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const gates = ['publicMarketing', 'publicIndexing', 'transport', 'oauth', 'discovery', 'paidGeneration', 'referenceUploads'] as const;
const engine = listFalEngines().find(entry => entry.modelSlug === 'wan-3')!;

for (const locale of ['en', 'fr', 'es'] as const) {
  test(`${locale}: Wan discovery follows MCP publication withdrawal without hiding unrelated content`, () => {
    const decisionContent = readModelDecisionInput('wan-3', locale);
    const visible = buildModelDecisionData({ engine, locale, decisionContent, mcpPublication: publication })!;
    assert.ok(visible.hero.quickLinks.some(link => link.href.endsWith('/mcp#the-hat-stays')));
    assert.ok(visible.decisionCards.some(card => card.cta.href.endsWith('/mcp#the-hat-stays')));
    for (const gate of gates) {
      const hidden = buildModelDecisionData({ engine, locale, decisionContent, mcpPublication: { ...publication, [gate]: false } })!;
      assert.doesNotMatch(JSON.stringify(hidden), /\/mcp#/);
      assert.equal(hidden.hero.quickLinks.length, visible.hero.quickLinks.length - 1, gate);
      assert.equal(hidden.decisionCards.length, visible.decisionCards.length - 1, gate);
      assert.deepEqual(hidden.features, visible.features);
    }
  });
  test(`${locale}: ads content withdraws the complete MCP story and retains its ranking`, async () => {
    const content = await parseMarkdownFile(`content/${locale}/best-for/ads.mdx`);
    const render = (mcpPublication: typeof publication) => renderToStaticMarkup(React.createElement(BestForContent, { content, contentComing: '', locale, mcpPublication }));
    const visible = render(publication);
    assert.match(visible, /\/mcp#main-character/);
    for (const gate of gates) {
      const hidden = render({ ...publication, [gate]: false });
      assert.doesNotMatch(hidden, /\/mcp#|Main Character/);
      assert.match(hidden, /Seedance 2.5/);
    }
  });
}
