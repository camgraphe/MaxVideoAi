import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('Studio review pages keep auth and server orchestration outside bounded views', () => {
  for (const path of ['frontend/app/(core)/admin/studio/page.tsx', 'frontend/app/(core)/admin/studio/[requestId]/page.tsx']) {
    const source = readFileSync(path, 'utf8');
    assert.ok(source.split('\n').length < 60);
    assert.match(source, /await requireAdmin\(\)/);
    assert.doesNotMatch(source, /response_json|<table|input_json|revealStudioReview/);
  }
  const route = readFileSync('frontend/app/api/admin/studio/review/route.ts', 'utf8');
  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /export.*GET/);
  const reveal = readFileSync('frontend/app/(core)/admin/studio/_components/StudioReviewReveal.client.tsx', 'utf8');
  assert.match(reveal, /method: 'POST'/);
  assert.doesNotMatch(reveal, /useEffect|dangerouslySetInnerHTML/);
});
