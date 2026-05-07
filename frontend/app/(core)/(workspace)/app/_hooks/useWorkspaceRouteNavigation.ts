import { useCallback, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/authFetch';

type UseWorkspaceRouteNavigationOptions = {
  authChecked: boolean;
  skipOnboardingRef: MutableRefObject<boolean>;
};

export function useWorkspaceRouteNavigation({
  authChecked,
  skipOnboardingRef,
}: UseWorkspaceRouteNavigationOptions) {
  const router = useRouter();

  useEffect(() => {
    if (!authChecked || skipOnboardingRef.current) return undefined;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[app] onboarding check running', { skip: skipOnboardingRef.current });
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/user/exports/summary');
        if (!res.ok) return;
        const json = await res.json();
        if (!json?.ok) return;
        if (cancelled) return;
        if ((json.total ?? 0) === 0 && json.onboardingDone !== true) {
          const params: Record<string, string> = { tab: 'starter', first: '1' };
          const search = new URLSearchParams(params).toString();
          router.replace(`/gallery?${search}`);
          await authFetch('/api/user/preferences', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ onboardingDone: true }),
          }).catch(() => undefined);
        }
      } catch (error) {
        console.warn('[app] onboarding redirect failed', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authChecked, router, skipOnboardingRef]);

  const replaceWorkspaceRoute = useCallback(
    (href: string) => {
      router.replace(href);
    },
    [router]
  );

  return {
    replaceWorkspaceRoute,
  };
}
