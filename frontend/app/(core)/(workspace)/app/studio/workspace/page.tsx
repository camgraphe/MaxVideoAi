import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURES } from '@/content/feature-flags';
import { requireAdmin } from '@/server/admin';
import WorkspacePage from './WorkspacePage.client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'MaxVideoAI Editor',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function StudioWorkspacePage() {
  if (!FEATURES.studio.maxVideoAiEditor) {
    notFound();
  }
  if (FEATURES.studio.adminOnly) {
    try {
      await requireAdmin();
    } catch {
      notFound();
    }
  }

  return <WorkspacePage />;
}
