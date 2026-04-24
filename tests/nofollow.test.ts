import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { applyNofollowRel, shouldNofollowHref } from '../frontend/lib/seo/nofollow';

test('internal app links remain followable', () => {
  assert.equal(shouldNofollowHref('/app'), false);
  assert.equal(shouldNofollowHref('/app/image'), false);
  assert.equal(shouldNofollowHref('/app?engine=sora-2-pro'), false);
  assert.equal(applyNofollowRel(undefined, '/app'), undefined);
});

test('internal video links remain followable', () => {
  assert.equal(shouldNofollowHref('/video/job_123'), false);
  assert.equal(applyNofollowRel(undefined, '/video/job_123?from=/models/sora-2-pro'), undefined);
});

test('explicit rel values are preserved', () => {
  assert.equal(applyNofollowRel('nofollow', '/app'), 'nofollow');
  assert.equal(applyNofollowRel('noopener noreferrer', '/app'), 'noopener noreferrer');
});

test('comparison generator CTAs are followable', () => {
  const pageSource = readFileSync(
    'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx',
    'utf8'
  );

  assert.equal(pageSource.includes('rel="nofollow"'), false);
});
