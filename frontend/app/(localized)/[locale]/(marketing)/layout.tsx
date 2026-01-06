import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { PartnerBadge } from '@/components/marketing/PartnerBadge';
import { PublicSessionWatchdog } from '@/components/auth/PublicSessionWatchdog';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <PublicSessionWatchdog />
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <div className="border-t border-hairline bg-white">
        <div className="mx-auto flex max-w-6xl justify-start px-4 py-4 sm:px-6 lg:px-8 md:justify-end">
          <PartnerBadge className="opacity-80 transition hover:opacity-100" />
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
