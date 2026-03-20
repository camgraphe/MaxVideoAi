import type { Metadata } from 'next';

import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import AudioWorkspace from './AudioWorkspace';

export const metadata: Metadata = {
  title: 'Generate Audio – MaxVideoAI Workspace',
  description: 'Add cinematic sound design, ambient score, and optional voice-over to your videos inside the MaxVideoAI workspace.',
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = 'force-dynamic';

export default function AudioGeneratePage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0 flex-col md:flex-row">
        <AppSidebar />
        <AudioWorkspace />
      </div>
    </div>
  );
}

