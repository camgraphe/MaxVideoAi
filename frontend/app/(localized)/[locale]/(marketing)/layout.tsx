import '@/styles/marketing-mcp.css';
import '@/styles/marketing-redesign.css';
import '@/styles/marketing-cinema.css';
import '@/styles/marketing-tools.css';
import '@/styles/marketing-navigation.css';
import { MarketingMotion } from '@/components/marketing/MarketingMotion.client';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { DeferredPublicSessionWatchdog } from '@/components/auth/DeferredPublicSessionWatchdog';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-site flex min-h-screen flex-col bg-bg">
      <DeferredPublicSessionWatchdog />
      <MarketingNav />
      <MarketingMotion />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
