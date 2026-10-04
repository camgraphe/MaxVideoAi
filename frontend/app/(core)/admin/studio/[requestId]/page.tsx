import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { reviewScopeSchema, StudioReviewError } from '@/server/admin-studio-review/contracts';
import { loadStudioReviewTurn } from '@/server/admin-studio-review/read-model';
import { AdminStudioDetail } from '../_components/AdminStudioDetail';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function AdminStudioTurnPage({ params, searchParams }: { params: Promise<{ requestId: string }>; searchParams: Promise<{ userId?: string | string[]; projectId?: string | string[] }> }) {
  try { await requireAdmin(); } catch { notFound(); }
  const { requestId } = await params;
  const parsed = reviewScopeSchema.safeParse({ ...await searchParams, requestId });
  if (!parsed.success) notFound();
  try { return <AdminStudioDetail turn={await loadStudioReviewTurn(parsed.data)} />; }
  catch (error) {
    if (error instanceof StudioReviewError && error.code === 'not_found') notFound();
    return <AdminStudioDetail unavailable />;
  }
}
