import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { resolveDictionary } from '@/lib/i18n/server';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';
import { isUserAdmin } from '@/server/admin';

export default async function VideoLayout({ children }: { children: React.ReactNode }) {
  const { locale, dictionary, fallback } = await resolveDictionary();
  let initialEmail: string | null = null;
  let initialUserId: string | null = null;
  let initialIsAdmin = false;

  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    initialEmail = user?.email ?? null;
    initialUserId = user?.id ?? null;
    if (initialUserId) {
      initialIsAdmin = await isUserAdmin(initialUserId);
    }
  } catch {
    initialEmail = null;
    initialUserId = null;
    initialIsAdmin = false;
  }

  return (
    <I18nProvider locale={locale} dictionary={dictionary} fallback={fallback}>
      <div className="flex min-h-screen flex-col bg-bg">
        <MarketingNav initialEmail={initialEmail} initialIsAdmin={initialIsAdmin} initialUserId={initialUserId} />
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    </I18nProvider>
  );
}
