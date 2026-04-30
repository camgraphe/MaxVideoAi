import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { formatCodexActionQueueMarkdown } from '@/lib/seo/codex-action-queue';
import { buildUnifiedActionBriefs } from '@/lib/seo/unified-action-briefs';
import { sanitizeUrlInspectionItemsForExport } from '@/lib/seo/url-inspection';
import { fetchSeoCockpitData } from '@/server/seo/cockpit';
import { fetchUrlInspectionDashboardData } from '@/server/seo/url-inspection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return withNoIndex(adminErrorToResponse(error));
  }

  const range = req.nextUrl.searchParams.get('range');
  const [data, urlInspection] = await Promise.all([
    fetchSeoCockpitData({ range }),
    fetchUrlInspectionDashboardData({ range }),
  ]);
  const unifiedActionBriefs = buildUnifiedActionBriefs({
    opportunities: data.opportunities,
    ctrDoctorItems: data.ctrDoctorItems,
    missingContentItems: data.missingContentItems,
    internalLinkSuggestions: data.internalLinkSuggestions,
    momentumItems: data.momentumItems,
    urlInspectionItems: urlInspection.items,
  });
  const exportUrlInspectionItems = sanitizeUrlInspectionItemsForExport(urlInspection.items);
  const format = req.nextUrl.searchParams.get('format') ?? 'markdown';

  if (format === 'json') {
    return withNoIndex(
      NextResponse.json(
        {
          ok: data.gsc.ok,
          generatedAt: new Date().toISOString(),
          range: data.gsc.range,
          actions: data.actions,
          opportunities: data.opportunities,
          ctrDoctorItems: data.ctrDoctorItems,
          missingContentItems: data.missingContentItems,
          internalLinkSuggestions: data.internalLinkSuggestions,
          momentumItems: data.momentumItems,
          urlInspectionItems: exportUrlInspectionItems,
          unifiedActionBriefs,
        },
        {
          headers: {
            'Content-Disposition': `attachment; filename="seo-opportunities-${data.gsc.range}.json"`,
          },
        }
      )
    );
  }

  const markdown = formatCodexActionQueueMarkdown(
    data.actions,
    data.ctrDoctorItems,
    data.missingContentItems,
    data.internalLinkSuggestions,
    data.momentumItems,
    exportUrlInspectionItems,
    unifiedActionBriefs
  );
  return withNoIndex(
    new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="codex-action-queue-${data.gsc.range}.md"`,
      },
    })
  );
}

function withNoIndex(response: NextResponse) {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
