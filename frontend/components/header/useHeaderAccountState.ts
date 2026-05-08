'use client';

import { useCallback, useEffect, useState } from 'react';
import { setLogoutIntent } from '@/lib/logout-intent';
import {
  clearLastKnownAccount,
  readLastKnownUserId,
  writeLastKnownUserId,
  writeLastKnownWallet,
} from '@/lib/last-known';
import { readBrowserSession } from '@/lib/supabase-auth-cleanup';
import { hasSupabaseAuthCookie } from '@/lib/supabase-session-hint';

type HeaderWalletState = { balance: number } | null;

async function getSupabaseClient() {
  const { supabase } = await import('@/lib/supabaseClient');
  return supabase;
}

function sendSignOutRequest() {
  void getSupabaseClient()
    .then((supabase) => supabase.auth.signOut())
    .catch(() => undefined);
  const payload = JSON.stringify({});
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon('/api/auth/signout', blob);
  } else {
    void fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }).catch(() => undefined);
  }
}

export function useHeaderAccountState() {
  const [email, setEmail] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [wallet, setWallet] = useState<HeaderWalletState>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchAccountState = async (token?: string | null, userId?: string | null) => {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      try {
        const [walletRes, adminRes] = await Promise.all([
          fetch('/api/wallet', { headers, cache: 'no-store' }),
          fetch('/api/admin/access', { headers, cache: 'no-store' }),
        ]);
        const walletJson = await walletRes.json().catch(() => null);
        const adminJson = await adminRes.json().catch(() => null);
        if (!mounted) return;
        const nextAdmin = Boolean(adminRes.ok && adminJson?.ok);
        setIsAdmin(nextAdmin);
        if (walletRes.ok) {
          const nextBalance = typeof walletJson?.balance === 'number' ? walletJson.balance : null;
          if (nextBalance !== null) {
            setWallet({ balance: nextBalance });
            const nextCurrency = typeof walletJson?.currency === 'string' ? walletJson.currency : undefined;
            writeLastKnownWallet(
              { balance: nextBalance, currency: nextCurrency },
              userId ?? readLastKnownUserId()
            );
          }
        }
      } catch {
        // Keep last known values on transient failures.
      }
    };
    const handleInvalidate = async () => {
      const session = await readBrowserSession();
      const userId = session?.user?.id ?? null;
      if (userId) {
        writeLastKnownUserId(userId);
      } else {
        setWallet(null);
        setIsAdmin(false);
        return;
      }
      await fetchAccountState(session?.access_token, userId);
    };
    let subscription: { subscription: { unsubscribe: () => void } } | null = null;
    if (!readLastKnownUserId() && !hasSupabaseAuthCookie()) {
      setEmail(null);
      setWallet(null);
      setIsAdmin(false);
      setAuthResolved(true);
      window.addEventListener('wallet:invalidate', handleInvalidate);
      return () => {
        mounted = false;
        window.removeEventListener('wallet:invalidate', handleInvalidate);
      };
    }
    void getSupabaseClient()
      .then(async (supabase) => {
        if (!mounted) return;
        const session = await readBrowserSession();
        if (!mounted) return;
        const userId = session?.user?.id ?? null;
        if (userId) {
          writeLastKnownUserId(userId);
        }
        setEmail(session?.user?.email ?? null);
        if (!userId) {
          setWallet(null);
          setIsAdmin(false);
        }
        setAuthResolved(true);
        if (userId) {
          void fetchAccountState(session?.access_token, userId);
        }
        const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;
          const eventType = event as string;
          if (eventType === 'SIGNED_OUT' || eventType === 'USER_DELETED') {
            clearLastKnownAccount();
            writeLastKnownUserId(null);
            setEmail(null);
            setWallet(null);
            setIsAdmin(false);
            setAuthResolved(true);
            return;
          }
          const userId = session?.user?.id ?? null;
          if (userId) {
            writeLastKnownUserId(userId);
          } else {
            setWallet(null);
            setIsAdmin(false);
          }
          setEmail(session?.user?.email ?? null);
          setAuthResolved(true);
          if (userId) {
            void fetchAccountState(session?.access_token, userId);
          }
        });
        subscription = sub;
      })
      .catch(() => {
        if (mounted) {
          setEmail(null);
          setWallet(null);
          setIsAdmin(false);
          setAuthResolved(true);
        }
      });
    window.addEventListener('wallet:invalidate', handleInvalidate);
    return () => {
      mounted = false;
      subscription?.subscription.unsubscribe();
      window.removeEventListener('wallet:invalidate', handleInvalidate);
    };
  }, []);

  const signOut = useCallback(() => {
    setLogoutIntent();
    setEmail(null);
    setWallet(null);
    setIsAdmin(false);
    clearLastKnownAccount();
    writeLastKnownUserId(null);
    sendSignOutRequest();
    window.location.href = '/';
  }, []);

  return {
    email,
    authResolved,
    wallet,
    isAdmin,
    signOut,
  };
}
