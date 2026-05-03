import { createSupabaseServerClient } from '@/lib/supabase-ssr';
import { isUserAdmin } from '@/server/admin';

export type MarketingAuthSnapshot = {
  email: string | null;
  isAdmin: boolean;
};

export async function getMarketingAuthSnapshot(): Promise<MarketingAuthSnapshot> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    const email = user?.email ?? null;
    if (!userId) {
      return { email: null, isAdmin: false };
    }
    return {
      email,
      isAdmin: await isUserAdmin(userId),
    };
  } catch {
    return { email: null, isAdmin: false };
  }
}
