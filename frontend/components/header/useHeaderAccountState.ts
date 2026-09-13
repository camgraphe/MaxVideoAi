'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { setLogoutIntent } from '@/lib/logout-intent';
import {
  clearLastKnownAccount,
  readLastKnownUserId,
  writeLastKnownUserId,
  writeLastKnownWallet,
} from '@/lib/last-known';
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
  const [walletLoading, setWalletLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const accountRequestIdRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let activeUserId: string | null = null;
    const fetchAccountState = async (token?: string | null, userId?: string | null) => {
      const requestId = ++accountRequestIdRef.current;
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      setWalletLoading(true);
      const isCurrentRequest = () => mounted && requestId === accountRequestIdRef.current;
      const walletRequest = (async () => {
        try {
          const walletRes = await fetch('/api/wallet', { headers, cache: 'no-store' });
          const walletJson = await walletRes.json().catch(() => null);
          if (!isCurrentRequest()) return;
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
          // Keep a usable balance on transient failures.
        } finally {
          if (isCurrentRequest()) {
            setWalletLoading(false);
          }
        }
      })();
      const adminRequest = (async () => {
        try {
          const adminRes = await fetch('/api/admin/access', { headers, cache: 'no-store' });
          const adminJson = await adminRes.json().catch(() => null);
          if (!isCurrentRequest()) return;
          setIsAdmin(Boolean(adminRes.ok && adminJson?.ok));
        } catch {
          // Keep the last known access state on transient failures.
        }
      })();
      await Promise.allSettled([walletRequest, adminRequest]);
    };
    const handleInvalidate = async () => {
      const supabase = await getSupabaseClient();
      if (!mounted) return;
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const session = data.session ?? null;
      const userId = session?.user?.id ?? null;
      if (userId) {
        writeLastKnownUserId(userId);
      } else {
        accountRequestIdRef.current += 1;
        setWallet(null);
        setWalletLoading(false);
        setIsAdmin(false);
        return;
      }
      await fetchAccountState(session?.access_token, userId);
    };
    let subscription: { subscription: { unsubscribe: () => void } } | null = null;
    if (!readLastKnownUserId() && !hasSupabaseAuthCookie()) {
      setEmail(null);
      setWallet(null);
      setWalletLoading(false);
      setIsAdmin(false);
      setAuthResolved(true);
      window.addEventListener('wallet:invalidate', handleInvalidate);
      return () => {
        mounted = false;
        accountRequestIdRef.current += 1;
        window.removeEventListener('wallet:invalidate', handleInvalidate);
      };
    }
    void getSupabaseClient()
      .then(async (supabase) => {
        if (!mounted) return;
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const session = data.session ?? null;
        const userId = session?.user?.id ?? null;
        activeUserId = userId;
        if (userId) {
          writeLastKnownUserId(userId);
        }
        setEmail(session?.user?.email ?? null);
        if (!userId) {
          accountRequestIdRef.current += 1;
          setWallet(null);
          setWalletLoading(false);
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
            accountRequestIdRef.current += 1;
            activeUserId = null;
            clearLastKnownAccount();
            writeLastKnownUserId(null);
            setEmail(null);
            setWallet(null);
            setWalletLoading(false);
            setIsAdmin(false);
            setAuthResolved(true);
            return;
          }
          const userId = session?.user?.id ?? null;
          if (activeUserId && activeUserId !== userId) {
            accountRequestIdRef.current += 1;
            setWallet(null);
            setIsAdmin(false);
          }
          activeUserId = userId;
          if (userId) {
            writeLastKnownUserId(userId);
          } else {
            accountRequestIdRef.current += 1;
            setWallet(null);
            setWalletLoading(false);
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
          setWalletLoading(false);
          setIsAdmin(false);
          setAuthResolved(true);
        }
      });
    window.addEventListener('wallet:invalidate', handleInvalidate);
    return () => {
      mounted = false;
      accountRequestIdRef.current += 1;
      subscription?.subscription.unsubscribe();
      window.removeEventListener('wallet:invalidate', handleInvalidate);
    };
  }, []);

  const signOut = useCallback(() => {
    accountRequestIdRef.current += 1;
    setLogoutIntent();
    setEmail(null);
    setWallet(null);
    setWalletLoading(false);
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
    walletLoading,
    isAdmin,
    signOut,
  };
}
