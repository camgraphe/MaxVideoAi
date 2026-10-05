import { useCallback, useEffect, type MutableRefObject } from 'react';
import { persistGoogleAuthCompleted } from '../_lib/login-auth-analytics';
import {
  clearStaleBrowserAuthState,
  isInvalidRefreshTokenError,
  readBrowserSession,
} from '@/lib/supabase-auth-cleanup';
import { hasSupabaseAuthCookie } from '@/lib/supabase-session-hint';
import { loadSupabaseClient } from '@/lib/supabaseClientLoader';
import {
  sanitizeNextPath,
} from '../_lib/login-helpers';

type UseLoginAuthenticatedRedirectOptions = {
  completeAuthenticatedRedirect: (target: string, authenticatedUserId?: string | null) => void;
  nextPath: string;
  nextPathReady: boolean;
  oauthCodeExchangeStartedRef: MutableRefObject<boolean>;
};

export function useLoginAuthenticatedRedirect({
  completeAuthenticatedRedirect,
  nextPath,
  nextPathReady,
  oauthCodeExchangeStartedRef,
}: UseLoginAuthenticatedRedirectOptions) {
  const redirectFromExistingBrowserSession = useCallback(
    async function redirectFromExistingBrowserSession(target: string): Promise<boolean> {
      const session = await readBrowserSession();
      const userId = session?.user?.id ?? null;
      if (!session?.access_token || !userId) return false;
      persistGoogleAuthCompleted(session.user?.created_at, session.user?.app_metadata, session.user?.id, session.access_token);
      completeAuthenticatedRedirect(target, userId);
      return true;
    },
    [completeAuthenticatedRedirect]
  );

  useEffect(() => {
    if (!nextPathReady) return;
    if (!hasSupabaseAuthCookie()) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    async function initializeAuthenticatedRedirect() {
      const supabase = await loadSupabaseClient();
      if (cancelled) return;

      const { data: authListener } = supabase.auth.onAuthStateChange(() => {
        if (oauthCodeExchangeStartedRef.current) return;
        void supabase.auth.getUser().then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            if (isInvalidRefreshTokenError(error)) {
              void clearStaleBrowserAuthState();
            }
            return;
          }
          const user = data.user ?? null;
          if (user && nextPath) {
            persistGoogleAuthCompleted(user.created_at, user.app_metadata, user.id);
            completeAuthenticatedRedirect(sanitizeNextPath(nextPath), user.id);
          }
        }).catch((err) => {
          if (cancelled) return;
          if (isInvalidRefreshTokenError(err)) {
            void clearStaleBrowserAuthState();
          }
        });
      });
      unsubscribe = () => authListener?.subscription.unsubscribe();

      if (oauthCodeExchangeStartedRef.current) return;
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          await clearStaleBrowserAuthState();
        }
        return;
      }
      const user = data.user ?? null;
      if (user && nextPath) {
        persistGoogleAuthCompleted(user.created_at, user.app_metadata, user.id);
        completeAuthenticatedRedirect(sanitizeNextPath(nextPath), user.id);
      }
    }

    void initializeAuthenticatedRedirect().catch((error) => {
      if (cancelled) return;
      if (isInvalidRefreshTokenError(error)) {
        void clearStaleBrowserAuthState();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [completeAuthenticatedRedirect, nextPath, nextPathReady, oauthCodeExchangeStartedRef]);

  useEffect(() => {
    if (!nextPathReady) return;
    if (oauthCodeExchangeStartedRef.current) return;
    if (!hasSupabaseAuthCookie()) return;
    let cancelled = false;
    readBrowserSession().then((session) => {
      if (cancelled) return;
      if (session?.access_token) {
        persistGoogleAuthCompleted(session.user?.created_at, session.user?.app_metadata, session.user?.id, session.access_token);
        completeAuthenticatedRedirect(sanitizeNextPath(nextPath), session.user?.id ?? null);
      }
    }).catch((err) => {
      if (cancelled) return;
      if (isInvalidRefreshTokenError(err)) {
        void clearStaleBrowserAuthState();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [completeAuthenticatedRedirect, nextPath, nextPathReady, oauthCodeExchangeStartedRef]);

  return { redirectFromExistingBrowserSession };
}
