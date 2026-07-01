import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const researchPath = 'docs/model-launch/gemini-omni-flash-seo-research.md';
const cannibalizationPath = 'docs/model-launch/gemini-omni-flash-cannibalization-map.md';
const linkingPath = 'docs/model-launch/gemini-omni-flash-linking-plan.md';

function read(path: string) {
  assert.ok(existsSync(path), `${path} should exist`);
  return readFileSync(path, 'utf8');
}

test('Gemini Omni Flash SEO research is source-backed before page publication', () => {
  const source = read(researchPath);
  assert.match(source, /# Gemini Omni Flash SEO Research/);
  assert.match(source, /Research Date:/);
  assert.match(source, /## Source Log/);
  assert.match(source, /## Keyword And Intent Map/);
  assert.match(source, /## SERP Findings/);
  assert.match(source, /## Page Strategy/);
  assert.match(source, /Google Cloud|Google AI|Google Search Central/);
  assert.match(source, /Search volume: not available in this run/i);
  assert.match(source, /fal\.ai.+market signal/i);
  const sourceRows = source.split('\n').filter((line) => /^\| .+ \| https?:\/\//.test(line));
  assert.ok(sourceRows.length >= 8, `expected at least 8 source-backed research rows, got ${sourceRows.length}`);
});

test('Gemini Omni Flash cannibalization map assigns one owner per intent', () => {
  const source = read(cannibalizationPath);
  assert.match(source, /# Gemini Omni Flash Cannibalization Map/);
  for (const intent of [
    'model decision',
    'Vertex implementation',
    'comparison',
    'pricing',
    'examples',
    'workspace generation',
  ]) {
    assert.match(source.toLowerCase(), new RegExp(intent.toLowerCase()), `${intent} should be mapped`);
  }
  assert.match(source, /\/models\/gemini-omni-flash/);
  assert.match(source, /\/ai-video-engines\/gemini-omni-flash-vs-veo-3-1/);
  assert.match(source, /Noindex Or Do Not Publish/);
});

test('Gemini Omni Flash linking plan controls anchors and avoids link stuffing', () => {
  const source = read(linkingPath);
  assert.match(source, /# Gemini Omni Flash Internal Linking Plan/);
  assert.match(source, /## Required Links/);
  assert.match(source, /## Anchor Rules/);
  assert.match(source, /## Links To Avoid/);
  assert.match(source, /descriptive/i);
  assert.doesNotMatch(source, /click here|read more/i);
  const requiredRows = source.split('\n').filter((line) => /^\| \/.+ \| \/.+ \| .+ \|/.test(line));
  assert.ok(requiredRows.length >= 8, `expected at least 8 planned internal links, got ${requiredRows.length}`);
});
