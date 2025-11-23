'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { clearSupabaseCookies, syncSupabaseCookies } from '@/lib/supabase-cookies';

export function AuthSessionSync() {
  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const session = data.session ?? null;
        if (session?.user) {
          syncSupabaseCookies(session);
        } else {
          clearSupabaseCookies();
        }
      })
      .catch(() => {
        if (!active) return;
        clearSupabaseCookies();
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        syncSupabaseCookies(session);
      } else {
        clearSupabaseCookies();
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return null;
}
