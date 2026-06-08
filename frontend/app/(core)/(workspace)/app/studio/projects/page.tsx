import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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

  return <StudioProjectsPageClient />;
}
