import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { assistantReviewScope, AssistantReviewError } from '@/server/admin-assistant-review/contracts';
import { loadAssistantReviewItem } from '@/server/admin-assistant-review/read-model';
import { AssistantReviewDetail } from '../_components/AssistantReviewDetail';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function AssistantReviewTurnPage({ params, searchParams }: { params: Promise<{ requestId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  try { await requireAdmin(); } catch { notFound(); }
  const parsed = assistantReviewScope.safeParse({ ...await searchParams, requestId: (await params).requestId });
  if (!parsed.success) notFound();
  try { return <AssistantReviewDetail item={await loadAssistantReviewItem(parsed.data)} />; }
  catch (error) {
    if (error instanceof AssistantReviewError && error.code === 'not_found') notFound();
    return <AssistantReviewDetail />;
  }
}
