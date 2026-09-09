import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { FEATURES } from '@/content/feature-flags';
import { headers } from 'next/headers';
import { isStudioMontageCreationEnabled } from '@/server/studio/feature-access';
import { resolveStudioPageAccess } from '@/server/studio/access';
import StudioProjectsPageClient from './StudioProjectsPage.client';
import StudioPreviewAccess from './StudioPreviewAccess.client';
import { resolveStudioMarketingStarter } from './studio-project-marketing-entry';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Studio Projects | MaxVideoAI',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function StudioProjectsPage({ searchParams }: {
  searchParams: Promise<{ starter?: string | string[]; preview?: string | string[] }>;
}) {
  if (!FEATURES.studio.maxVideoAiEditor) {
    notFound();
  }
  const query = await searchParams;
  const access = await resolveStudioPageAccess();
  if (!access.ok && access.status === 404) notFound();
  if (!access.ok || query.preview === 'studio-beta') {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex min-w-0 flex-1 flex-col md:flex-row">
          <AppSidebar />
          <main className="min-w-0 flex-1 overflow-y-auto">
            <StudioPreviewAccess />
          </main>
        </div>
      </div>
    );
  }
  const initialStarterTemplateId = resolveStudioMarketingStarter(query.starter);
  const requestHeaders = await headers();
  const montageCreationEnabled = isStudioMontageCreationEnabled(
    process.env,
    requestHeaders.get('host'),
    (FEATURES.mcp as Record<string, boolean>).studioMontageCreation === true,
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto p-5 lg:p-7">
          <StudioProjectsPageClient
            initialStarterTemplateId={initialStarterTemplateId}
            montageCreationEnabled={montageCreationEnabled}
          />
        </main>
      </div>
    </div>
  );
}
