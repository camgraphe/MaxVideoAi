import type { Metadata } from 'next';

import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import VideoAgentsWorkspace from './VideoAgentsWorkspace';

export const metadata: Metadata = {
  title: 'Video Agents - MaxVideoAI Workspace',
  description: 'Create guided commercial videos with MaxVideoAI Video Agents.',
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = 'force-dynamic';

export default function VideoAgentsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0 flex-col md:flex-row">
        <AppSidebar />
        <VideoAgentsWorkspace />
      </div>
    </div>
  );
}
