import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const seoSignalFiles = [
  'frontend/lib/seo/content-momentum.ts',
  'frontend/lib/seo/content-momentum-format.ts',
  'frontend/lib/seo/content-momentum-scoring.ts',
  'frontend/lib/seo/internal-link-builder.ts',
  'frontend/lib/seo/internal-link-builder-format.ts',
  'frontend/lib/seo/internal-link-builder-helpers.ts',
  'frontend/lib/seo/seo-opportunity-engine.ts',
  'frontend/lib/seo/seo-url.ts',
  'frontend/lib/seo/unified-action-briefs.ts',
  'frontend/lib/seo/unified-action-brief-format.ts',
];

function source(path: string) {
  return readFileSync(path, 'utf8');
}

function lineCount(path: string) {
  return source(path).split('\n').length;
}

test('SEO signal helpers stay split across focused modules', () => {
  seoSignalFiles.forEach((path) => {
    assert.equal(existsSync(path), true, `${path} should exist`);
    assert.ok(lineCount(path) < 500, `${path} should stay under 500 lines`);
  });

  const momentumSource = source('frontend/lib/seo/content-momentum.ts');
  const internalLinksSource = source('frontend/lib/seo/internal-link-builder.ts');
  const opportunitySource = source('frontend/lib/seo/seo-opportunity-engine.ts');
  const unifiedSource = source('frontend/lib/seo/unified-action-briefs.ts');

  assert.match(momentumSource, /content-momentum-format/);
  assert.match(momentumSource, /content-momentum-scoring/);
  assert.match(internalLinksSource, /internal-link-builder-format/);
  assert.match(internalLinksSource, /internal-link-builder-helpers/);
  assert.match(opportunitySource, /export \{ stripOrigin \} from '\.\/seo-url';/);
  assert.match(unifiedSource, /unified-action-brief-format/);
});
