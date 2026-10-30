import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { assistantReviewFilter } from '@/server/admin-assistant-review/contracts';
import { loadAssistantReviews } from '@/server/admin-assistant-review/read-model';
import { AssistantReviewList } from './_components/AssistantReviewList';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function AssistantReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  try { await requireAdmin(); } catch { notFound(); }
  const parsed = assistantReviewFilter.safeParse(Object.fromEntries(Object.entries(await searchParams).filter(([, value]) => value !== '')));
  if (!parsed.success) return <AssistantReviewList invalid />;
  return <AssistantReviewList filter={parsed.data} data={await loadAssistantReviews(parsed.data)} />;
}
