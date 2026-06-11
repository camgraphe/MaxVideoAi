import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { FEATURES } from '@/content/feature-flags';
import StudioProjectsPageClient from './StudioProjectsPage.client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Studio Projects | MaxVideoAI',
  robots: {
    index: false,
    follow: false,
  },
};

export default function StudioProjectsPage() {
  if (!FEATURES.studio.maxVideoAiEditor) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto p-5 lg:p-7">
          <StudioProjectsPageClient />
        </main>
      </div>
    </div>
  );
}
