import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homeSource = readFileSync('frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx', 'utf8');
const englishMessages = JSON.parse(readFileSync('frontend/messages/en.json', 'utf8')) as {
  home?: { meta?: { title?: string; description?: string } };
};

test('homepage title keeps the AI video generator category while preserving engine comparison intent', () => {
  const title = englishMessages.home?.meta?.title ?? '';

  assert.match(title, /AI Video Generator/);
  assert.match(title, /Engine Comparison/);
  assert.match(title, /MaxVideoAI/);
});

test('homepage structured data keeps Organization schema alongside WebApplication schema', () => {
  assert.match(homeSource, /home-webapp-jsonld/);
  assert.match(homeSource, /home-organization-jsonld/);
  assert.match(homeSource, /'@type': 'Organization'/);
  assert.match(homeSource, /logo: 'https:\/\/maxvideoai\.com\/favicon-512\.png'/);
});
