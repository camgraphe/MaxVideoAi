import { NextRequest, NextResponse } from 'next/server';
import { resolveStudioMarketingStarter } from '@/app/(core)/(workspace)/app/studio/projects/studio-project-marketing-entry';
import { buildLoginHref } from '@/lib/auth-entry-href';
import { hasMarketingNavigationSession } from '@/server/marketing-auth';
import { AdminAuthError, requireAdmin } from '@/server/admin';

const STUDIO_PROJECTS_PATH = '/app/studio/projects';

export const dynamic = 'force-dynamic';

function resolveProjectsPath(starter: string | null): string {
  if (!starter || !resolveStudioMarketingStarter(starter)) return STUDIO_PROJECTS_PATH;
  return `${STUDIO_PROJECTS_PATH}?starter=${encodeURIComponent(starter)}`;
}

export async function GET(request: NextRequest) {
  const projectsPath = resolveProjectsPath(request.nextUrl.searchParams.get('starter'));
  let destination: string;
  try {
    await requireAdmin(request);
    destination = projectsPath;
  } catch (error) {
    const signedIn = await hasMarketingNavigationSession();
    destination = signedIn || (error instanceof AdminAuthError && error.status === 403)
      ? '/app'
      : buildLoginHref({ mode: 'signin', nextPath: projectsPath });
  }
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: destination },
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
