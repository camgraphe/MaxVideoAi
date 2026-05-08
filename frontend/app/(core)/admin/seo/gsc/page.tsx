import { normalizeGscRange } from '@/lib/seo/gsc-analysis';
import { fetchGscDashboardData } from '@/server/seo/gsc';
import { GscDashboardView } from './_components/GscDashboardView';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    range?: string | string[];
  }>;
};

export default async function AdminGscSeoPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const range = normalizeGscRange(Array.isArray(searchParams?.range) ? searchParams?.range[0] : searchParams?.range);
  const data = await fetchGscDashboardData({ range });

  return <GscDashboardView data={data} range={range} />;
}
