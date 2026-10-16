import type {NextRequest} from 'next/server';
import {resolveStudioRouteContext} from '../../../_lib/studio-route-utils';
import {readOwnedCompletedTimelineExport} from '@/server/timeline-exports/media-access';
import {createTimelineExportReadUrl} from '@/server/timeline-exports/media-security';

export const runtime = 'nodejs';
type RouteProps = {params: Promise<{exportId: string}>};

async function deliver(req: NextRequest, props: RouteProps, method: 'GET' | 'HEAD') {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;
  const {exportId} = await props.params;
  const headers = {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer'};
  const job = await readOwnedCompletedTimelineExport({userId: context.userId,exportId});
  if (!job) return new Response(null,{status: 404,headers});
  try {
    const downloadFilename = method === 'GET' && req.nextUrl.searchParams.get('download') === '1'
      ? `${(job.project_name || 'MaxVideoAI Export').slice(0,150)}.mp4` : undefined;
    const location = await createTimelineExportReadUrl({
      url: job.output_url!,userId: context.userId,requestOrigin: req.nextUrl.origin,method,
      ...(downloadFilename ? {downloadFilename} : {}),
    });
    // 307 preserves method and Range; a fresh request to this stable URL renews access.
    return new Response(null,{status: 307,headers: {...headers,Location: location}});
  } catch {
    return new Response(null,{status: 404,headers});
  }
}

export function GET(req: NextRequest, props: RouteProps) { return deliver(req,props,'GET'); }
export function HEAD(req: NextRequest, props: RouteProps) { return deliver(req,props,'HEAD'); }
