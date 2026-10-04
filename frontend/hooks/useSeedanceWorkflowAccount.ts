'use client';
import { useEffect, useState } from 'react';
export type SeedanceWorkflowAccount = { userId: string; token: string };
type WorkflowSession = { user: { id: string }; access_token: string } | null;
type AuthClient = { auth: { onAuthStateChange: (callback: (event: string, session: WorkflowSession) => void) => { data: { subscription: { unsubscribe(): void } } };
  getSession(): Promise<{ data: { session: WorkflowSession } }> } };
const loadWorkflowClient = async (): Promise<AuthClient> => (await import('@/lib/supabaseClient')).supabase;
/** Confirmed session only; hints never authorize a final quote or submission. */
export function useSeedanceWorkflowAccount(loadClient = loadWorkflowClient) {
  const [account, setAccount] = useState<SeedanceWorkflowAccount | null>(null);
  useEffect(() => {
    let canceled = false;
    let unsubscribe: (() => void) | undefined;
    void loadClient().then(async (supabase) => {
      const apply = (session: { user: { id: string }; access_token: string } | null) => {
        if (!canceled) setAccount(session ? { userId: session.user.id, token: session.access_token } : null);
      };
      let observedAuthEvent = false;
      const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => { observedAuthEvent = true; apply(session); });
      unsubscribe = () => subscription.subscription.unsubscribe();
      const { data } = await supabase.auth.getSession();
      if (!observedAuthEvent) apply(data.session);
    }).catch(() => { if (!canceled) setAccount(null); });
    return () => { canceled = true; unsubscribe?.(); };
  }, [loadClient]);
  return account;
}
