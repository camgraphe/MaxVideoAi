import { NextRequest, NextResponse } from 'next/server';
import { resolveStudioMarketingStarter } from '@/app/(core)/(workspace)/app/studio/_lib/studio-project-marketing-entry';
import { buildLoginHref } from '@/lib/auth-entry-href';
import { locales } from '@/i18n/locales';
import {
  resolveStudioApiAccess,
  type StudioAccessDecision,
} from '@/server/studio/access';

const STUDIO_PROJECTS_PATH = '/app/studio';

function resolveProjectsPath(starter: string | null): string {
  if (!starter || !resolveStudioMarketingStarter(starter)) return '/app/studio';
  return `${STUDIO_PROJECTS_PATH}?starter=${encodeURIComponent(starter)}`;
}

export async function handleStudioMarketingEntry(
  request: NextRequest,
  resolveAccess: (request: NextRequest) => Promise<StudioAccessDecision> = resolveStudioApiAccess,
) {
  const projectsPath = resolveProjectsPath(request.nextUrl.searchParams.get('starter'));
  const language = request.nextUrl.searchParams.get('lang');
  const locale = locales.find(candidate => candidate === language);
  const access = await resolveAccess(request);
  const destination = access.ok
    ? projectsPath
    : access.status === 401
      ? buildLoginHref({ mode: 'signup', nextPath: projectsPath, locale })
      : '/app';
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: destination },
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
