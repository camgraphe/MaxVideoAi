import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('editorial preview route delegates the trend shortlist to a server component', () => {
  const page = readFileSync('frontend/app/(core)/admin/editorial/[articleId]/page.tsx', 'utf8');
  const section = readFileSync('frontend/app/(core)/admin/editorial/_components/EditorialTrendResearch.tsx', 'utf8');
  assert.ok(page.split('\n').length < 100);
  assert.match(page, /<EditorialTrendResearch research=\{version\.draft\.research\}/);
  assert.doesNotMatch(page, /research\.signals\.map/);
  assert.doesNotMatch(section, /['"]use client['"]/);
  assert.match(section, /Topic shortlist/);
});
