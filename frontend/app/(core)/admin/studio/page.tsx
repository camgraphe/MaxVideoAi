import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { reviewListSchema } from '@/server/admin-studio-review/contracts';
import { loadStudioReviewList } from '@/server/admin-studio-review/read-model';
import { AdminStudioList } from './_components/AdminStudioList';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function AdminStudioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  try { await requireAdmin(); } catch { notFound(); }
  const params = await searchParams;
  const parsed = reviewListSchema.safeParse(Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '')));
  if (!parsed.success) return <AdminStudioList invalid />;
  const data = await loadStudioReviewList(parsed.data);
  return <AdminStudioList data={data} filter={parsed.data} />;
}
