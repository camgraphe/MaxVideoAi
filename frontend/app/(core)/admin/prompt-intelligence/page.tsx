import { notFound } from 'next/navigation';

import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { requireAdmin } from '@/server/admin';
import {
  fetchPromptIntelligenceReviewCandidate,
  fetchPromptIntelligenceReviewQueue,
  isPromptIntelligenceStorageReady,
  normalizePromptReviewVerdict,
  type PromptReviewStatusFilter,
} from '@/server/prompt-intelligence';
import { PromptIntelligenceReviewView } from './_components/PromptIntelligenceReviewView';
import { savePromptResultReviewAction } from './_actions';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    jobId?: string;
    reviewStatus?: string;
    engineId?: string;
    q?: string;
  }>;
};

export default async function PromptIntelligencePage(props: PageProps) {
  const searchParams = await props.searchParams;

  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/prompt-intelligence] access denied', error);
    notFound();
  }

  const filters = buildFilters(searchParams);
  if (!process.env.DATABASE_URL) {
    return (
      <PromptIntelligenceReviewView
        queue={[]}
        selected={null}
        filters={filters}
        reviewAction={savePromptResultReviewAction}
        notice={
          <AdminNotice tone="warning">
            Database connection is not configured. Set <code className="font-mono text-xs">DATABASE_URL</code> to review prompt performance.
          </AdminNotice>
        }
      />
    );
  }

  const storageReady = await isPromptIntelligenceStorageReady();
  if (!storageReady) {
    return (
      <PromptIntelligenceReviewView
        queue={[]}
        selected={null}
        filters={filters}
        reviewAction={savePromptResultReviewAction}
        notice={
          <AdminNotice tone="warning">
            Prompt intelligence tables are not installed yet. Run the Neon migration{' '}
            <code className="font-mono text-xs">26_prompt_intelligence_reviews.sql</code> to enable prompt/result reviews.
          </AdminNotice>
        }
      />
    );
  }

  const queue = await fetchPromptIntelligenceReviewQueue({
    limit: 80,
    reviewStatus: filters.reviewStatus,
    engineId: filters.engineId,
    search: filters.q,
  });
  const selectedJobId = searchParams?.jobId?.trim() || queue[0]?.jobId || '';
  const selected = selectedJobId ? await fetchPromptIntelligenceReviewCandidate(selectedJobId) : null;

  return (
    <PromptIntelligenceReviewView
      queue={queue}
      selected={selected}
      filters={filters}
      reviewAction={savePromptResultReviewAction}
    />
  );
}

function buildFilters(searchParams?: Awaited<PageProps['searchParams']>) {
  return {
    reviewStatus: normalizeReviewStatusFilter(searchParams?.reviewStatus),
    engineId: searchParams?.engineId?.trim() || null,
    q: searchParams?.q?.trim() || null,
  };
}

function normalizeReviewStatusFilter(value: unknown): PromptReviewStatusFilter {
  if (value === 'all' || value === 'unreviewed' || value === 'reviewed') return value;
  if (typeof value === 'string' && value.trim()) return normalizePromptReviewVerdict(value);
  return 'unreviewed';
}
