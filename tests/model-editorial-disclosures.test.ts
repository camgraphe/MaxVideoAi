import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { ModelDecisionSafetyFaqSection } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionSafetyFaqSection';
import { localizeSpecStatus } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-spec-status';
import { ModelPrepLinksSection } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPrepLinksSection';
import mcpPublication from '../frontend/config/mcp-publication.json';
import type { SoraCopy } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('closed model FAQ keeps complete answers in server HTML and matching structured data', () => {
  const questions = [{ question: 'Quels réglages ?', answer: 'Choisissez la durée et la résolution.' }];
  const html = renderToStaticMarkup(React.createElement(ModelDecisionSafetyFaqSection, {
    copy: {} as SoraCopy, modelName: 'Exemple', safetyRules: [], safetyInterpretation: [],
    faqList: questions, faqTitle: 'Questions', locale: 'fr', faqJsonLdEntries: questions, safetyTitle: 'Sécurité',
  }));
  assert.equal((html.match(/<details\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<details[^>]*\sopen(?:[\s=>])/);
  assert.match(html, /Choisissez la durée et la résolution\.<\/p>/);
  const payload = JSON.parse(html.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]);
  assert.equal(payload.mainEntity[0].acceptedAnswer.text, questions[0].answer);
  assert.equal(payload.mainEntity[0].name, questions[0].question);
});

test('compact safety disclosure preserves supplied model rules and interpretation', () => {
  const html = renderToStaticMarkup(React.createElement(ModelDecisionSafetyFaqSection, {
    copy: {} as SoraCopy, modelName: 'Exemple', safetyRules: ['Règle propre au modèle.'],
    safetyInterpretation: ['Précision importante.'], faqList: [], faqTitle: null, locale: 'fr',
    faqJsonLdEntries: [], safetyTitle: 'Sécurité',
  }));
  assert.match(html, /Règle propre au modèle\./);
  assert.match(html, /Précision importante\./);
  assert.doesNotMatch(html, /personnages originaux/);
  assert.doesNotMatch(html, /FAQPage/);
});

test('localized capability labels retain numerical limits and unknown values', () => {
  const input = 'Up to 3 video references; 2-15s each and 15s combined';
  assert.equal(localizeSpecStatus(input, 'fr'), 'Jusqu’à 3 vidéos de référence ; 2–15 s chacune, 15 s au total');
  assert.equal(localizeSpecStatus(input, 'es'), 'Hasta 3 videos de referencia; 2–15 s cada uno, 15 s en total');
  assert.equal(localizeSpecStatus('Supported (start image + optional end image)', 'fr'), 'Pris en charge (image de départ et image de fin facultative)');
  assert.equal(localizeSpecStatus('Native stereo audio', 'es'), 'Audio estéreo nativo');
  assert.equal(localizeSpecStatus('768p / 2K / 4K', 'fr'), '768p / 2K / 4K');
  assert.equal(localizeSpecStatus('Unknown new capability', 'es'), 'Unknown new capability');
  assert.equal(localizeSpecStatus(input, 'en'), input);
});


test('model pages retain a localized contextual MCP link when no prep tools are supplied', () => {
  for (const locale of ['fr', 'es'] as const) {
    const html = renderToStaticMarkup(React.createElement(ModelPrepLinksSection, { prepLinksSection: null, locale }));
    assert.match(html, new RegExp(`href="/${locale}/mcp"`));
    assert.equal((html.match(/<a\b/g) ?? []).length, 1);
    assert.match(html, /compatibles/);
    assert.doesNotMatch(html, /<h[1-6]\b|<img\b/);
  }
});

test('the compact model MCP entry disappears when public indexing is disabled', () => {
  const original = mcpPublication.publicIndexing;
  try {
    mcpPublication.publicIndexing = false;
    assert.equal(ModelPrepLinksSection({ prepLinksSection: null, locale: 'fr' }), null);
  } finally {
    mcpPublication.publicIndexing = original;
  }
});
