import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';
import { isUserAdmin } from '@/server/admin';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
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
    <div className="flex min-h-screen flex-col bg-bg">
      <MarketingNav initialEmail={initialEmail} initialIsAdmin={initialIsAdmin} initialUserId={initialUserId} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
