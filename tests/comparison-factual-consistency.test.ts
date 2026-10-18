import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import catalog from '../frontend/config/engine-catalog.json';
import specsFile from '../data/benchmarks/engine-key-specs.v1.json';
import en from '../frontend/messages/en.json';
import fr from '../frontend/messages/fr.json';
import es from '../frontend/messages/es.json';
import { buildSpecValues } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-values';
import { buildCompareFaqItems, buildCompareFaqJsonLd } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-faq';
import { renderSpecValue } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareSpecValue';
import { CompareSpecsSection } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareSpecsSection';
import { pickCapabilityDifference, pickOutputDifference } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-score-utils';

// JSX in the source uses the project's classic test transform.
Object.assign(globalThis, { React });
const left = catalog.find(x => x.modelSlug === 'gemini-omni-flash')!;
const right = catalog.find(x => x.modelSlug === 'veo-3-1')!;
const specs = (entry: typeof left) => buildSpecValues(entry, specsFile.specs.find(x => x.modelSlug === entry.modelSlug)?.keySpecs);
const labels = { pending: 'Data pending', supported: 'Supported', notSupported: 'Not supported' };

test('equal known resolutions are shared facts, not missing evidence', () => {
  const templates = { value: '{left}: {leftValue}; {right}: {rightValue}', pending: '{label}: pending', shared: '{label}: both support {value}' };
  assert.equal(pickOutputDifference('A', 'B', '4K', '4K', 'Resolution', templates, 'pending'), 'Resolution: both support 4K');
  assert.match(pickOutputDifference('A', 'B', 'Data pending', '4K', 'Resolution', templates, 'pending'), /pending/);
  assert.match(pickOutputDifference('A', 'B', '1080p', '4K', 'Resolution', templates, 'pending'), /1080p.*4K/);
});

test('different positive lip-sync descriptions do not invent a capability difference', () => {
  assert.equal(pickCapabilityDifference(left, right, 'Lip sync', 'Supported through native dialogue and audio generation', 'Supported', { value: '{leftValue} vs {rightValue}', pending: 'pending' }, 'pending'), null);
});

test('specification rendering preserves limits and accessible yes/no text', () => {
  for (const value of ['Supported (up to 10 reference images)', 'Supported (Extend from one source video)', 'Not supported', 'Data pending']) {
    const html = renderToStaticMarkup(renderSpecValue(value, 'en', labels));
    assert.ok(html.includes(value), html);
  }
});

test('specification sources render model annotations as text and only HTTP sources as links', () => {
  const miniSources = specsFile.specs.find(x => x.modelSlug === 'dreamina-seedance-2-0-mini')!.sources;
  const annotation = miniSources.find(value => value.startsWith('Dreamina Seedance API model id:'))!;
  assert.ok(annotation, 'real catalog includes a non-URL source annotation');
  const html = renderToStaticMarkup(React.createElement(CompareSpecsSection, {
    activeLocale: 'en', compareCopy: en.comparePage, labels, left, right,
    pairHasNativeAudio: true, specRows: [], sources: [{ name: 'Mini', urls: [
      ...miniSources, 'https://example.com/first', 'https://example.com/second',
      'javascript:alert(1)', 'file:///private/source', 'not a URL',
    ] }],
  }));
  assert.ok(html.includes(annotation), 'preserve the authored model identity note');
  assert.match(html, /href="https:\/\/example.com\/first"[^>]*>example.com \(1\)</);
  assert.match(html, /href="https:\/\/example.com\/second"[^>]*>example.com \(2\)</);
  assert.doesNotMatch(html, /href="(?:javascript:|file:|Dreamina|not a URL)/);
});

for (const [locale, dictionary] of Object.entries({ en, fr, es })) {
  test(`${locale} Omni/Veo FAQ and schema agree on resolution and retain reference limits`, () => {
    const items = buildCompareFaqItems({ activeLocale: locale as 'en' | 'fr' | 'es', compareCopy: dictionary.comparePage, labels, left, right,
      leftPricingDisplay: { headline: '$0.135/s', subline: null, prices: [13.5] }, rightPricingDisplay: { headline: '$0.52/s', subline: null, prices: [52] },
      leftSpecs: specs(left), rightSpecs: specs(right), pairHasKling3Native4k: false, pairHasNativeAudio: true, specLabels: dictionary.comparePage.specLabels, hasShowdownSlots: false });
    const differences = items.find(x => /biggest|grandes diff|mayores dif|principales dif/i.test(x.question))!;
    assert.ok(differences);
    const text = JSON.stringify(differences.answer);
    assert.match(text, /4K/);
    assert.doesNotMatch(text, /validated|validation|validando|validación|Lip sync/i);
    const references = items.find(x => /start and end|début.*fin|inicio.*fin|First\/Last/i.test(x.question) || /references\?|références\s*\?|referencias\?/i.test(x.question));
    assert.match(JSON.stringify(references?.answer), /10/);
    const jsonld = buildCompareFaqJsonLd(items);
    const structured = jsonld.mainEntity.find(x => x.name === differences.question)!;
    assert.equal(structured.acceptedAnswer.text, Array.isArray(differences.answer) ? differences.answer.join(' ') : differences.answer);
  });
}

test('new-clip durations exclude extensions and retain mode-specific limits', () => {
  const omni = specs(left);
  const veo = specs(right);
  assert.equal(omni.maxDuration, '10 s');
  assert.equal(veo.maxDuration, '8 s');
  assert.deepEqual(veo.generationDurations?.find(x => x.mode === 't2v')?.seconds, [4, 6, 8]);
  assert.deepEqual(veo.generationDurations?.find(x => x.mode === 'i2v')?.seconds, [8]);
  assert.equal(veo.extensionDuration, '7 s');
  assert.equal(omni.generationDurations?.some(x => ['v2v', 'refine', 'extend'].includes(x.mode)), false);
});

for (const pending of ['en cours de validation', 'aún en validación']) {
  test(`localized unknown resolution remains unknown: ${pending}`, () => {
    const output = pickOutputDifference('A', 'B', pending, pending, 'Resolution', { value: '{leftValue} vs {rightValue}', pending: 'Unknown', shared: 'Both {value}' }, pending);
    assert.equal(output, 'Unknown');
  });
}

test('a model without an extension mode is explicitly unsupported, not unknown', () => {
  const sora = catalog.find(x => x.modelSlug === 'sora-2')!;
  assert.equal(specs(sora).extensionDuration, 'Not supported');
});
