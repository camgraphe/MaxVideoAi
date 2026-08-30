'use client';

const SUPABASE_AUTH_COOKIE_PATTERN = /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/;

type SupabaseAuthClientGateOptions = {
  hasSessionHint: () => boolean;
  startAuthClient: () => void;
  windowTarget?: EventTarget;
  documentTarget?: EventTarget;
  isDocumentVisible?: () => boolean;
};

export function hasSupabaseAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return SUPABASE_AUTH_COOKIE_PATTERN.test(document.cookie);
}

export function installSupabaseAuthClientGate({
  hasSessionHint,
  startAuthClient,
  windowTarget = typeof window === 'undefined' ? undefined : window,
  documentTarget = typeof document === 'undefined' ? undefined : document,
  isDocumentVisible = () => typeof document !== 'undefined' && document.visibilityState === 'visible',
}: SupabaseAuthClientGateOptions): () => void {
  let listening = false;
  let started = false;
  let stopped = false;

  const stopListening = () => {
    if (!listening) return;
    windowTarget?.removeEventListener('focus', handleFocus);
    windowTarget?.removeEventListener('pageshow', handleFocus);
    documentTarget?.removeEventListener('visibilitychange', handleVisibility);
    listening = false;
  };

  const maybeStart = () => {
    if (stopped || started || !hasSessionHint()) return;
    started = true;
    stopListening();
    startAuthClient();
  };

  function handleFocus() {
    maybeStart();
  }

  function handleVisibility() {
    if (isDocumentVisible()) {
      maybeStart();
    }
  }

  if (windowTarget && documentTarget) {
    windowTarget.addEventListener('focus', handleFocus);
    windowTarget.addEventListener('pageshow', handleFocus);
    documentTarget.addEventListener('visibilitychange', handleVisibility);
    listening = true;
  }
  maybeStart();

  return () => {
    stopped = true;
    stopListening();
  };
}
