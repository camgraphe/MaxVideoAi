'use client';
import { useEffect, useState } from 'react';

export function useStudioMediaAccount() {
  const [accountId, setAccountId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let revision = 0;
    void import('@/lib/supabaseClient').then(async ({ supabase }) => {
      if (!active) return;
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        revision += 1;
        if (active) setAccountId(session?.user.id ?? null);
      });
      unsubscribe = () => listener.subscription.unsubscribe();
      const requestedRevision = revision;
      const { data } = await supabase.auth.getSession();
      if (active && revision === requestedRevision) setAccountId(data.session?.user.id ?? null);
    }).catch(() => undefined);
    return () => { active = false; unsubscribe?.(); };
  }, []);
  return accountId;
}
