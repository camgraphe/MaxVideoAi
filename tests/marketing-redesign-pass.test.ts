import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { buildHomeComparisonData } from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-comparison-data';
import { PairedScores } from '../frontend/components/marketing/PairedScores';
import { HomeComparisonScores } from '../frontend/components/marketing/home/HomeComparisonScores.client';
import { MARKETING_SITE_NAV_LINKS, MARKETING_TOP_NAV_LINKS } from '../frontend/config/navigation';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('paired comparison preserves zero and missing scores without inventing geometry', () => {
  const element = PairedScores({ metrics: [{ id: 'motion', label: 'Motion', tooltip: 'Movement', leftValue: 0, rightValue: null }] });
  const row = element.props.children[0];
  const track = row.props.children[1];
  assert.equal(track.props.children[0].props.style.left, '0%');
  assert.equal(track.props.children[1], null);
  assert.equal(row.props.children[0].type, 'details');
});

test('paired comparison uses a common scale and rejects invalid ratings', () => {
  const element = PairedScores({ metrics: [{ id: 'quality', label: 'Quality', leftValue: 8.6, rightValue: 9.1 }, { id: 'missing', label: 'Missing', leftValue: NaN, rightValue: 11 }] });
  const [first, invalid] = element.props.children;
  assert.equal(first.props.children[1].props.children[0].props.style.left, '86%');
  assert.equal(first.props.children[1].props.children[1].props.style.left, '91%');
  assert.deepEqual(invalid.props.children[1].props.children, [null, null]);
});

test('site navigation exposes assistants without changing the app shared destinations', () => {
  assert.equal(MARKETING_SITE_NAV_LINKS.find((item) => item.key === 'connect')?.href, '/mcp');
  assert.ok(MARKETING_TOP_NAV_LINKS.some((item) => item.key === 'blog'));
});

test('motion is marketing scoped and never hides critical content', () => {
  const source = readFileSync('frontend/components/marketing/MarketingMotion.client.tsx', 'utf8');
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(source, /getBoundingClientRect\(/, 'deferred sections must not be synchronously laid out for decorative motion');
  assert.match(source, /entry\.boundingClientRect\.top/);
  assert.doesNotMatch(source, /opacity|visibility:|display:/);
  assert.match(source, /animation.cancel\(\)/);
});

test('home merges inspiration and examples while retaining discovery data in the server section', () => {
  const route = readFileSync('frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx', 'utf8');
  const section = readFileSync('frontend/components/marketing/home/HomeModelDiscovery.tsx', 'utf8');
  const discovery = readFileSync('frontend/app/(localized)/[locale]/(marketing)/(home)/_components/HomeDiscovery.tsx', 'utf8');
  const worlds = readFileSync('frontend/components/marketing/home/HomeCreativeWorlds.tsx', 'utf8');
  assert.doesNotMatch(route, /RealExamplesPreview/);
  assert.match(route, /HomeCreativeWorlds locale=\{locale\} cards=\{primaryBestForCards\} examplesCopy=\{content.examples\} modelDiscovery=\{/);
  const boundary = route.slice(route.indexOf('<Suspense'), route.indexOf('</Suspense>'));
  assert.match(boundary, /fallback=\{<HomeModelDiscovery locale=\{locale\} examples=\{fallbackExamples\} providers=\{providers\} copy=\{content.examples\}/);
  assert.match(boundary, /<HomeDiscovery locale=\{locale\} examples=\{pendingData.examples\} providers=\{providers\} copy=\{content.examples\}/);
  assert.doesNotMatch(boundary, /<HomeHero|<HomeCreativeWorlds|<CreativeFilm/);
  assert.match(worlds, /modelDiscovery \?\? <HomeModelDiscovery/);
  assert.doesNotMatch(discovery, /'use client'/);
  assert.match(discovery, /<HomeModelDiscovery locale=\{locale\} examples=\{await examples\} providers=\{providers\} copy=\{copy\}/);
  assert.doesNotMatch(section, /'use client'/);
  assert.match(section, /href=\{example.href\}/);
  assert.match(section, /example.modelHref \?\? example.href/);
  assert.match(section, /examplesCtaVisible !== false/);
});


test('home comparison uses the full comparator global-score calculation and counts available criteria', () => {
  const data = buildHomeComparisonData(new Map([
    ['wan-3', {fidelity:0, motion:6, consistency:9, visualQuality:10}],
    ['seedance-2-5', {fidelity:9, motion:9, consistency:9, visualQuality:8}],
  ]));
  assert.equal(data.left.slug, 'wan-3');
  assert.equal(data.left.overall, 5);
  assert.equal(data.left.criteriaCount, 4);
  assert.deepEqual(data.left.scores, [0,10,6]);
  assert.equal(data.opponents.length, 1);
  assert.equal(data.opponents[0].overall, 9);
  assert.equal(buildHomeComparisonData(new Map()).left.overall, null);
});


test('home tools reuse catalogue artwork and model guidance remains image-led without extra video readers', () => {
  const tools = readFileSync('frontend/components/marketing/home/HomeToolsGallery.tsx', 'utf8');
  const choice = readFileSync('frontend/components/marketing/home/HomeCreativeWorlds.tsx', 'utf8');
  assert.match(tools, /import \{ QUICK_TOOL_ART, WORKSHOP_ART \}/);
  assert.match(tools, /loading="lazy"/);
  assert.match(choice, /HOME_USE_CASE_FILMS.map/);
  assert.match(choice, /<CreativeFilm/);
  assert.match(choice, /<HomeModelDiscovery/);
  assert.match(choice, /href=\{card.href\}/);
  assert.doesNotMatch(tools + choice, /<video|autoPlay|preload=/);
});

test('workspace follows the hero and the conversation section owns optional assistant access', () => {
  const route = readFileSync('frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx', 'utf8');
  const creation = readFileSync('frontend/components/marketing/home/HomeCreationSection.tsx', 'utf8');
  const conversation = readFileSync('frontend/components/marketing/home/HomeConversationSection.tsx', 'utf8');
  const sections = ['<HomeHero', '<HomeCreationSection', '<HomeCreativeWorlds', '<HomeModelChoice', '<HomeToolsGallery', '<HomeConversationSection', '<HomePricingSection'];
  for (const [index, section] of sections.entries()) {
    assert.ok(route.includes(section), `${section} remains in the route`);
    if (index) assert.ok(route.indexOf(sections[index - 1]) < route.indexOf(section), `${section} preserves the approved section order`);
  }
  assert.equal(route.match(/<HomeConversationSection\b/g)?.length, 1);
  assert.match(route, /HomeConversationSection locale=\{locale\} assistantHref=\{mcpLink\?\.href\}/);
  assert.doesNotMatch(route, /HomeAssistantWorkflow/);
  assert.doesNotMatch(creation, /HomeAssistantStrip|assistantHref/);
  assert.match(conversation, /id="studio"/);
  assert.match(conversation, /assistantHref \? <HomeAssistantStrip locale=\{locale\} href=\{assistantHref\}/);
});


test('homepage excerpt and full comparison preserve the common score scale and missing values', () => {
  const home = readFileSync('frontend/components/marketing/home/HomeComparisonScores.client.tsx', 'utf8');
  const comparison = readFileSync('frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/CompareScoreboard.client.tsx', 'utf8');
  assert.match(comparison, /<PairedScores metrics=\{metrics\}/);
  assert.doesNotMatch(home, /comparison-bar|comparison-pair/);
  const html = renderToStaticMarkup(React.createElement(HomeComparisonScores, {
    label: 'Comparison excerpt',
    leftName: 'Wan 3',
    leftOverall: 0,
    metrics: [
      { id: 'zero', label: 'Zero and missing', leftValue: 0, rightValue: null },
      { id: 'valid', label: 'Valid', leftValue: 8.6, rightValue: 9.1 },
      { id: 'nonfinite', label: 'Nonfinite', leftValue: NaN, rightValue: Infinity },
      { id: 'outside', label: 'Outside scale', leftValue: -1, rightValue: 11 },
    ],
  }));
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelector('caption')?.textContent, 'Comparison excerpt');
  assert.equal(document.querySelector('.home-score-overall strong')?.textContent, '0.0');
  const rows = [...document.querySelectorAll('tbody tr')];
  const values = (index: number) => [...rows[index].querySelectorAll('.home-score-number')].map(node => node.textContent);
  const widths = (index: number) => [...rows[index].querySelectorAll('.home-score-track')].map(node => node.querySelector('span')?.style.width ?? null);
  assert.deepEqual(values(0), ['0.0/10', '—']);
  assert.deepEqual(widths(0), ['0%', null]);
  assert.deepEqual(values(1), ['8.6/10', '9.1/10']);
  assert.deepEqual(widths(1), ['86%', '91%']);
  for (const index of [2, 3]) {
    assert.deepEqual(values(index), ['—', '—']);
    assert.deepEqual(widths(index), [null, null]);
  }
});
