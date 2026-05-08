'use client';

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { AuthMode } from '../_lib/login-copy';

type UseLoginAutofillSyncParams = {
  mode: AuthMode;
  setEmail: Dispatch<SetStateAction<string>>;
  setPassword: Dispatch<SetStateAction<string>>;
};

export function useLoginAutofillSync({ mode, setEmail, setPassword }: UseLoginAutofillSyncParams) {
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const syncInputState = useCallback(() => {
    const nextEmail = emailRef.current?.value ?? '';
    const nextPassword = passwordRef.current?.value ?? '';
    setEmail((prev) => (prev === nextEmail ? prev : nextEmail));
    setPassword((prev) => (prev === nextPassword ? prev : nextPassword));
  }, [setEmail, setPassword]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    syncInputState();
    const timers = [window.setTimeout(syncInputState, 100), window.setTimeout(syncInputState, 500)];
    const handle = () => syncInputState();
    const emailEl = emailRef.current;
    const passwordEl = passwordRef.current;
    emailEl?.addEventListener('input', handle);
    emailEl?.addEventListener('change', handle);
    passwordEl?.addEventListener('input', handle);
    passwordEl?.addEventListener('change', handle);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      emailEl?.removeEventListener('input', handle);
      emailEl?.removeEventListener('change', handle);
      passwordEl?.removeEventListener('input', handle);
      passwordEl?.removeEventListener('change', handle);
    };
  }, [syncInputState, mode]);

  return {
    emailRef,
    passwordRef,
    syncInputState,
  };
}
