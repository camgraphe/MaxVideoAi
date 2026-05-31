import { notFound } from 'next/navigation';

import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { requireAdmin } from '@/server/admin';
import {
  fetchAiStrategistConversationReviews,
  isAiStrategistConversationReviewStorageReady,
  normalizeAiStrategistReviewStatus,
  type AiStrategistReviewStatus,
} from '@/server/ai-strategist-conversations';
import { AiStrategistConversationReviewView } from './_components/AiStrategistConversationReviewView';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    reviewStatus?: string;
    model?: string;
    q?: string;
  }>;
};

export default async function AiStrategistConversationReviewsPage(props: PageProps) {
  const searchParams = await props.searchParams;

  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/ai-strategist-conversations] access denied', error);
    notFound();
  }

  if (!process.env.DATABASE_URL) {
    return (
      <AiStrategistConversationReviewView
        conversations={[]}
        filters={buildFilters(searchParams)}
        notice={
          <AdminNotice tone="warning">
            Database connection is not configured. Set <code className="font-mono text-xs">DATABASE_URL</code> to review AI Strategist conversations.
          </AdminNotice>
        }
      />
    );
  }

  const filters = buildFilters(searchParams);
  const storageReady = await isAiStrategistConversationReviewStorageReady();
  if (!storageReady) {
    return (
      <AiStrategistConversationReviewView
        conversations={[]}
        filters={filters}
        notice={
          <AdminNotice tone="warning">
            AI Strategist review tables are not installed yet. Run the Neon migration{' '}
            <code className="font-mono text-xs">25_ai_strategist_conversations.sql</code> to enable conversation storage.
          </AdminNotice>
        }
      />
    );
  }

  const conversations = await fetchAiStrategistConversationReviews({
    limit: 100,
    reviewStatus: filters.reviewStatus,
    selectedModel: filters.model,
    search: filters.q,
  });

  return <AiStrategistConversationReviewView conversations={conversations} filters={filters} />;
}

function buildFilters(searchParams?: Awaited<PageProps['searchParams']>) {
  const requestedStatus = searchParams?.reviewStatus === 'all'
    ? 'all'
    : normalizeAiStrategistReviewStatus(searchParams?.reviewStatus);
  return {
    reviewStatus: requestedStatus as AiStrategistReviewStatus | 'all',
    model: searchParams?.model?.trim() || null,
    q: searchParams?.q?.trim() || null,
  };
}
