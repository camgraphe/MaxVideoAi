'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { consumeStudioMediaHandoff, type StudioMediaHandoff } from '@/lib/studio-media-handoff';

export function useStudioMediaHandoff(accountId: string, projectId?: string) {
  const params = useSearchParams();
  const token = params?.get('studioMedia');
  const scope = accountId !== 'anonymous' && projectId && token ? JSON.stringify([accountId, projectId, token]) : null;
  const attempted = useRef<string | null>(null);
  const [pending, setPending] = useState<{ scope: string; handoff: StudioMediaHandoff } | null>(null);
  useEffect(() => {
    if (attempted.current === scope) return;
    attempted.current = scope;
    setPending(null);
    if (!scope || !token) return;
    try {
      const handoff = consumeStudioMediaHandoff(window.sessionStorage, accountId, token);
      if (handoff) setPending({ scope, handoff });
    } catch { /* Storage denied: no insertion. */ }
  }, [accountId, scope, token]);
  return { scope, handoff: pending?.scope === scope ? pending?.handoff ?? null : null,
    close: () => setPending((current) => current?.scope === scope ? null : current) };
}
