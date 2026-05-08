import { normalizeGscRange } from '@/lib/seo/gsc-analysis';
import { buildUnifiedActionBriefs } from '@/lib/seo/unified-action-briefs';
import { fetchSeoCockpitData } from '@/server/seo/cockpit';
import { fetchUrlInspectionDashboardData } from '@/server/seo/url-inspection';
import { SeoCockpitView } from './_components/SeoCockpitView';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    range?: string | string[];
  }>;
};

export default async function AdminSeoCockpitPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const range = normalizeGscRange(Array.isArray(searchParams?.range) ? searchParams?.range[0] : searchParams?.range);
  const [data, urlInspection] = await Promise.all([
    fetchSeoCockpitData({ range }),
    fetchUrlInspectionDashboardData({ range }),
  ]);
  const unifiedBriefs = buildUnifiedActionBriefs({
    opportunities: data.opportunities,
    ctrDoctorItems: data.ctrDoctorItems,
    missingContentItems: data.missingContentItems,
    internalLinkSuggestions: data.internalLinkSuggestions,
    momentumItems: data.momentumItems,
    urlInspectionItems: urlInspection.items,
  });

  return (
    <SeoCockpitView
      data={data}
      range={range}
      unifiedBriefs={unifiedBriefs}
      urlInspectionItems={urlInspection.items}
    />
  );
}
