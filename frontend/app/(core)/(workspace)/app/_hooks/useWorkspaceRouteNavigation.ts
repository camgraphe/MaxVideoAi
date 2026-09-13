import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

export function useWorkspaceRouteNavigation() {
  const router = useRouter();

  // First-use onboarding stays in the workspace's existing starter feed.
  // Never replace an explicit creation/auth continuation with a gallery redirect.
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
