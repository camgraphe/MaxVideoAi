import assert from 'node:assert/strict';
import test from 'node:test';
import { validateVideoSeoEditorialUpdatePayload } from '../frontend/server/video-seo-editorial.ts';

const completeApprovedPayload = {
  seoStatus: 'approved',
  seoTitle: 'Sora 2 Editorial Video Example for Admin Validation',
  metaDescription:
    'Watch a complete Sora 2 editorial validation example with enough metadata, model routing and public assets for video SEO.',
  h1: 'Sora 2 editorial video example for admin validation',
  videoObjectName: 'Sora 2 editorial video example for admin validation',
  shortDescription:
    'This admin validation fixture represents a complete video SEO watch page with editorial copy, target keyword and model links.',
  targetKeyword: 'Sora 2 editorial video example',
  intent: 'prompt-example',
  modelSlug: 'sora-2',
  examplesSlug: 'sora',
};

const qaContext = {
  promptText:
    'A detailed cinematic video prompt with subject, location, lighting, camera movement, timing, output format, production intent, visual style, scene continuity, pacing, camera lens, audio cues and final framing for a complete SEO validation fixture.',
  hasVideoAsset: true,
  hasThumbnailAsset: true,
  technicallyIndexable: true,
  duplicateVideoObjectNames: new Set<string>(),
};

test('video SEO update validation rejects invalid status and intent', () => {
  const invalidStatus = validateVideoSeoEditorialUpdatePayload({
    videoId: 'job_test',
    payload: { ...completeApprovedPayload, seoStatus: 'live' },
    qaContext,
  });
  assert.equal(invalidStatus.ok, false);
  assert.match(invalidStatus.error, /Invalid seoStatus/);

  const invalidIntent = validateVideoSeoEditorialUpdatePayload({
    videoId: 'job_test',
    payload: { ...completeApprovedPayload, intent: 'viral' },
    qaContext,
  });
  assert.equal(invalidIntent.ok, false);
  assert.match(invalidIntent.error, /Invalid intent/);
});

test('video SEO update validation stays permissive for draft-style statuses', () => {
  for (const seoStatus of ['candidate', 'draft', 'needs_edits', 'disabled']) {
    const result = validateVideoSeoEditorialUpdatePayload({
      videoId: `job_${seoStatus}`,
      payload: { seoStatus, intent: 'prompt-example', seoTitle: '' },
      qaContext,
    });
    assert.equal(result.ok, true, `${seoStatus} should remain saveable while incomplete`);
    assert.equal(result.entry.seoStatus, seoStatus);
  }
});

test('video SEO update validation blocks approved pages with missing critical fields or failing QA', () => {
  const missingField = validateVideoSeoEditorialUpdatePayload({
    videoId: 'job_test',
    payload: { ...completeApprovedPayload, targetKeyword: '' },
    qaContext,
  });
  assert.equal(missingField.ok, false);
  assert.match(missingField.error, /Approved video SEO pages require/);

  const failingQa = validateVideoSeoEditorialUpdatePayload({
    videoId: 'job_test',
    payload: completeApprovedPayload,
    qaContext: { ...qaContext, hasThumbnailAsset: false },
  });
  assert.equal(failingQa.ok, false);
  assert.match(failingQa.error, /failed QA/i);
});

test('video SEO update validation accepts complete approved pages that pass QA', () => {
  const result = validateVideoSeoEditorialUpdatePayload({
    videoId: 'job_test',
    payload: completeApprovedPayload,
    qaContext,
  });
  assert.equal(result.ok, true);
  assert.equal(result.entry.seoStatus, 'approved');
  assert.equal(result.qa.passed, true);
});
