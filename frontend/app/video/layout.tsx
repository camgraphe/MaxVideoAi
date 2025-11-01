import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { resolveDictionary } from '@/lib/i18n/server';

export default function VideoLayout({ children }: { children: React.ReactNode }) {
  const { locale, dictionary, fallback } = resolveDictionary();

  return (
    <I18nProvider locale={locale} dictionary={dictionary} fallback={fallback}>
      <div className="flex min-h-screen flex-col bg-bg">
        <MarketingNav />
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    </I18nProvider>
  );
}
