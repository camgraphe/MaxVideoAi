import type { ReactNode } from 'react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { getMarketingAuthSnapshot } from '@/server/marketing-auth';

export async function MarketingVideoLayout({ children }: { children: ReactNode }) {
  const auth = await getMarketingAuthSnapshot();

  return <div className="marketing-site flex min-h-screen flex-col bg-bg">
    <MarketingNav initialEmail={auth.email} initialIsAdmin={auth.isAdmin} />
    <main className="flex-1">{children}</main>
    <MarketingFooter />
  </div>;
}
