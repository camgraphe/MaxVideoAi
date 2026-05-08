'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { AuthMode } from '../_lib/login-copy';

type UseLoginModeFromQueryParams = {
  setMode: Dispatch<SetStateAction<AuthMode>>;
};

export function useLoginModeFromQuery({ setMode }: UseLoginModeFromQueryParams) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paramMode = params.get('mode');
    if (paramMode === 'signin' || paramMode === 'signup' || paramMode === 'reset') {
      setMode(paramMode);
    }
  }, [setMode]);
}
