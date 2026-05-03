import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { DeferredPublicSessionWatchdog } from '@/components/auth/DeferredPublicSessionWatchdog';
import { getMarketingAuthSnapshot } from '@/server/marketing-auth';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const auth = await getMarketingAuthSnapshot();

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <DeferredPublicSessionWatchdog />
      <MarketingNav initialEmail={auth.email} initialIsAdmin={auth.isAdmin} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
