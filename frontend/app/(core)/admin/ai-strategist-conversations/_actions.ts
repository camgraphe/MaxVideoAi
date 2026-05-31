'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  normalizeAiStrategistReviewStatus,
  updateAiStrategistConversationReview,
} from '@/server/ai-strategist-conversations';
import { requireAdmin } from '@/server/admin';
import { parseReviewTags } from './_lib/ai-strategist-conversation-format';

export async function updateAiStrategistConversationReviewAction(formData: FormData) {
  const adminId = await requireAdmin();
  const conversationId = stringField(formData.get('conversationId'));
  if (!conversationId) {
    throw new Error('Missing conversation id');
  }

  await updateAiStrategistConversationReview({
    conversationId,
    reviewStatus: normalizeAiStrategistReviewStatus(formData.get('reviewStatus')),
    reviewTags: parseReviewTags(formData.get('reviewTags')),
    reviewerNotes: stringField(formData.get('reviewerNotes')),
    reviewedBy: adminId,
  });

  revalidatePath('/admin/ai-strategist-conversations');
  revalidatePath(`/admin/ai-strategist-conversations/${conversationId}`);
  redirect(`/admin/ai-strategist-conversations/${conversationId}`);
}

function stringField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
