import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getExampleModelLanding } from '../frontend/lib/examples/modelLanding';

const root = process.cwd();

function collectStrings(value: unknown, prefix = ''): Array<{ path: string; value: string }> {
  if (typeof value === 'string') {
    return [{ path: prefix, value }];
  }
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectStrings(entry, `${prefix}.${index}`));
  }
  return Object.entries(value).flatMap(([key, entry]) => collectStrings(entry, prefix ? `${prefix}.${key}` : key));
}

function findForbiddenCopy(strings: Array<{ path: string; value: string }>, forbidden: RegExp[]) {
  return strings.flatMap((entry) =>
    forbidden
      .filter((pattern) => pattern.test(entry.value))
      .map((pattern) => `${entry.path}: ${entry.value} [${pattern.source}]`)
  );
}

describe('French SEO copy', () => {
  test('localized comparison and gallery dictionaries avoid English UI terms', () => {
    const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'frontend/messages/fr.json'), 'utf8'));
    const scopedValues = collectStrings({
      gallery: dictionary.gallery,
      examples: dictionary.examples,
      comparePage: dictionary.comparePage,
    });
    const failures = findForbiddenCopy(scopedValues, [
      /\bspecs?\b/i,
      /\bscorecard\b/i,
      /\bworkflow(s)?\b/i,
      /\bpatterns?\b/i,
      /\bText-to-video\b/,
      /\bImage-to-video\b/,
      /\bVideo-to-video\b/,
      /\bpricing\b/i,
    ]);

    assert.deepEqual(failures, []);
  });

  test('French model gallery landing copy avoids English workflow labels', () => {
    const slugs = ['veo', 'luma', 'kling', 'seedance', 'ltx', 'pika', 'hailuo'];
    const strings = slugs.flatMap((slug) => collectStrings(getExampleModelLanding('fr', slug), slug));
    const failures = findForbiddenCopy(strings, [
      /\bimage-to-video\b/i,
      /\btext-to-video\b/i,
      /\bvideo-to-video\b/i,
      /\bspecs?\b/i,
      /\bworkflow(s)?\b/i,
      /\bsetup(s)?\b/i,
      /\bdrafts?\b/i,
      /\bruns?\b/i,
      /\bpatterns?\b/i,
      /\bpricing\b/i,
      /\btier\b/i,
      /\bstill\b/i,
      /\baudio-ready\b/i,
    ]);

    assert.deepEqual(failures, []);
  });
});
