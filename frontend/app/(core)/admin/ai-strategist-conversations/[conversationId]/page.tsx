import { notFound } from 'next/navigation';

import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { requireAdmin } from '@/server/admin';
import {
  fetchAiStrategistConversationReviewDetail,
  isAiStrategistConversationReviewStorageReady,
} from '@/server/ai-strategist-conversations';
import { updateAiStrategistConversationReviewAction } from '../_actions';
import { AiStrategistConversationDetailView } from '../_components/AiStrategistConversationDetailView';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ conversationId: string }>;
};

export default async function AiStrategistConversationReviewDetailPage(props: PageProps) {
  const params = await props.params;

  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/ai-strategist-conversations/detail] access denied', error);
    notFound();
  }

  if (!process.env.DATABASE_URL) {
    return (
      <AiStrategistConversationDetailView
        detail={null}
        reviewAction={updateAiStrategistConversationReviewAction}
        notice={
          <AdminNotice tone="warning">
            Database connection is not configured. Set <code className="font-mono text-xs">DATABASE_URL</code> to review this conversation.
          </AdminNotice>
        }
      />
    );
  }

  const storageReady = await isAiStrategistConversationReviewStorageReady();
  if (!storageReady) {
    return (
      <AiStrategistConversationDetailView
        detail={null}
        reviewAction={updateAiStrategistConversationReviewAction}
        notice={
          <AdminNotice tone="warning">
            AI Strategist review tables are not installed yet. Run the Neon migration{' '}
            <code className="font-mono text-xs">25_ai_strategist_conversations.sql</code> to enable conversation storage.
          </AdminNotice>
        }
      />
    );
  }

  const detail = await fetchAiStrategistConversationReviewDetail(params.conversationId);
  if (!detail) {
    notFound();
  }

  return (
    <AiStrategistConversationDetailView
      detail={detail}
      reviewAction={updateAiStrategistConversationReviewAction}
    />
  );
}
