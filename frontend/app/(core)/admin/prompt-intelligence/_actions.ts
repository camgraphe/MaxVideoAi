'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '@/server/admin';
import {
  normalizePromptReviewIntent,
  normalizePromptReviewVerdict,
  savePromptResultReview,
} from '@/server/prompt-intelligence';
import {
  parsePromptReviewBoolean,
  parsePromptReviewLines,
  parsePromptReviewScore,
  parsePromptReviewTags,
} from './_lib/prompt-intelligence-format';

export async function savePromptResultReviewAction(formData: FormData) {
  const reviewerId = await requireAdmin();
  const jobId = stringField(formData.get('jobId'));
  if (!jobId) {
    throw new Error('Missing job id');
  }

  await savePromptResultReview({
    jobId,
    reviewerId,
    intent: normalizePromptReviewIntent(formData.get('intent')),
    verdict: normalizePromptReviewVerdict(formData.get('verdict')),
    promptSource: stringField(formData.get('promptSource')) ?? 'manual',
    promptStructureId: stringField(formData.get('promptStructureId')),
    promptStructureVersion: stringField(formData.get('promptStructureVersion')),
    strategistVersion: stringField(formData.get('strategistVersion')),
    modelCatalogVersion: stringField(formData.get('modelCatalogVersion')),
    overallScore: parsePromptReviewScore(formData.get('overallScore')),
    promptMatchScore: parsePromptReviewScore(formData.get('promptMatchScore')),
    modelFitScore: parsePromptReviewScore(formData.get('modelFitScore')),
    workflowFitScore: parsePromptReviewScore(formData.get('workflowFitScore')),
    visualQualityScore: parsePromptReviewScore(formData.get('visualQualityScore')),
    motionScore: parsePromptReviewScore(formData.get('motionScore')),
    cameraScore: parsePromptReviewScore(formData.get('cameraScore')),
    commercialUseScore: parsePromptReviewScore(formData.get('commercialUseScore')),
    seoPotentialScore: parsePromptReviewScore(formData.get('seoPotentialScore')),
    productPreservationScore: parsePromptReviewScore(formData.get('productPreservationScore')),
    characterPreservationScore: parsePromptReviewScore(formData.get('characterPreservationScore')),
    textLogoAccuracyScore: parsePromptReviewScore(formData.get('textLogoAccuracyScore')),
    audioLipSyncScore: parsePromptReviewScore(formData.get('audioLipSyncScore')),
    tags: parsePromptReviewTags(formData.get('tags')),
    blockers: parsePromptReviewLines(formData.get('blockers')),
    improvementSuggestions: parsePromptReviewLines(formData.get('improvementSuggestions')),
    avoidPatternSummary: stringField(formData.get('avoidPatternSummary')),
    notes: stringField(formData.get('notes')),
    createPattern: parsePromptReviewBoolean(formData.get('createPattern')),
    qcmAnswersJson: {
      mainIssue: stringField(formData.get('mainIssue')),
      nextAction: stringField(formData.get('nextAction')),
      reviewDepth: stringField(formData.get('reviewDepth')) ?? 'quick',
    },
  });

  revalidatePath('/admin/prompt-intelligence');
  redirect('/admin/prompt-intelligence');
}

function stringField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
