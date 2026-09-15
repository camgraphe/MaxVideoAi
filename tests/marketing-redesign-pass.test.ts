import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { buildHomeComparisonData } from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-comparison-data';
import { PairedScores } from '../frontend/components/marketing/PairedScores';
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
  assert.match(source, /getBoundingClientRect\(\)\.top > window.innerHeight/);
  assert.doesNotMatch(source, /opacity|visibility:|display:/);
  assert.match(source, /animation.cancel\(\)/);
});

test('home merges inspiration and examples while retaining discovery data in the server section', () => {
  const route = readFileSync('frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx', 'utf8');
  const section = readFileSync('frontend/components/marketing/home/HomeModelDiscovery.tsx', 'utf8');
  assert.doesNotMatch(route, /RealExamplesPreview/);
  assert.match(route, /HomeCreativeWorlds locale=\{locale\} cards=\{primaryBestForCards\} examples=\{examples\} providers=\{providers\}/);
  assert.doesNotMatch(section, /'use client'/);
  assert.match(section, /href=\{example.href\}/);
  assert.match(section, /example.modelHref \?\? example.href/);
  assert.match(section, /examplesCtaVisible !== false/);
});


test('home comparison uses the full comparator global-score calculation and counts available criteria', () => {
  const data = buildHomeComparisonData(new Map([
    ['kling-3-pro', {fidelity:0, motion:6, consistency:9, visualQuality:10}],
    ['seedance-2-5', {fidelity:9, motion:9, consistency:9, visualQuality:8}],
  ]));
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

test('workspace follows the hero and owns optional assistant access instead of a separate home chapter', () => {
  const route = readFileSync('frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx', 'utf8');
  const creation = readFileSync('frontend/components/marketing/home/HomeCreationSection.tsx', 'utf8');
  assert.ok(route.indexOf('<HomeHero') < route.indexOf('<HomeCreationSection'));
  assert.ok(route.indexOf('<HomeCreationSection') < route.indexOf('<HomeCreativeWorlds'));
  assert.match(route, /assistantHref=\{mcpLink\?\.href\}/);
  assert.doesNotMatch(route, /HomeAssistantWorkflow/);
  assert.match(creation, /assistantHref \? <HomeAssistantStrip/);
});


test('homepage and full comparison use the same score presentation', () => {
  const home = readFileSync('frontend/components/marketing/home/HomeComparisonScores.client.tsx', 'utf8');
  const comparison = readFileSync('frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/CompareScoreboard.client.tsx', 'utf8');
  for (const source of [home, comparison]) assert.match(source, /<PairedScores metrics=\{metrics\}/);
  assert.doesNotMatch(home, /comparison-bar|comparison-pair/);
});
