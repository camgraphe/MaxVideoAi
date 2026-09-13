import { useCallback, useLayoutEffect, useRef } from 'react';
import type { PreflightResponse } from '@/types/engines';

export function useWorkspaceSubmissionScope({ draft, preflight, accessToken, authChecked }: {
  draft: Record<string, unknown>;
  preflight: PreflightResponse | null;
  accessToken: string | null;
  authChecked: boolean;
}) {
  const epoch = useRef<{ draftKey: string; preflight: PreflightResponse | null; accessToken: string | null; authChecked: boolean } | null>(null);
  const draftKey = JSON.stringify(draft);
  // Publish committed identity only; abandoned speculative renders must not cancel a submission.
  useLayoutEffect(() => {
    epoch.current = { draftKey, preflight, accessToken, authChecked };
    return () => { epoch.current = null; };
  }, [draftKey, preflight, accessToken, authChecked]);
  const captureAttempt = useCallback(() => {
    const captured = epoch.current;
    const isCurrent = () => captured !== null && epoch.current === captured
      && captured.draftKey === draftKey && captured.preflight === preflight
      && captured.accessToken === accessToken && captured.authChecked === authChecked;
    return {
      isCurrent,
      isQuoteCurrent: (token: string) => isCurrent() && authChecked && token === accessToken && Boolean(preflight?.ok),
    };
  }, [draftKey, preflight, accessToken, authChecked]);
  const isMounted = useCallback(() => epoch.current !== null, []);
  return { captureAttempt, isMounted };
}
