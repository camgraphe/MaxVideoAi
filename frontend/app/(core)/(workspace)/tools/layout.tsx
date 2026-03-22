import type { ReactNode } from 'react';
import { PublicSessionWatchdog } from '@/components/auth/PublicSessionWatchdog';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';

export default function ToolsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <PublicSessionWatchdog />
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
