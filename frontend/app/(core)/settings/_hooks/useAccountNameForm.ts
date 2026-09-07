'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { loadSupabaseClient } from '@/lib/supabaseClientLoader';
import { getAccountName, updateAccountName, validateAccountName } from '../_lib/account-preferences';

export function useAccountNameForm(user: User | null) {
  const initialName = getAccountName(user);
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const requestRef = useRef(0);
  const userIdRef = useRef(user?.id ?? null);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
    requestRef.current += 1;
    setName(initialName);
    setSavedName(initialName);
    setBusy(false);
    setStatus(null);
    // Account metadata events for the same user must not cancel their own save completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const validation = validateAccountName(name);
  const dirty = Boolean(user) && validation.name !== savedName.trim();

  const cancel = () => {
    requestRef.current += 1;
    setName(savedName);
    setBusy(false);
    setStatus(null);
  };

  const changeName = (value: string) => {
    setName(value);
    setStatus(null);
  };

  const save = async (messages: { required: string; tooLong: string; generic: string; success: string }) => {
    if (!user || busy) return;
    if (validation.error) {
      setStatus({ kind: 'error', message: messages[validation.error] });
      return;
    }
    const request = ++requestRef.current;
    const expectedUserId = user.id;
    setBusy(true);
    setStatus(null);
    try {
      const client = await loadSupabaseClient();
      await updateAccountName(client, user, validation.name);
      if (requestRef.current !== request || userIdRef.current !== expectedUserId) return;
      setName(validation.name);
      setSavedName(validation.name);
      setStatus({ kind: 'success', message: messages.success });
    } catch (error) {
      if (requestRef.current !== request || userIdRef.current !== expectedUserId) return;
      setStatus({ kind: 'error', message: error instanceof Error && error.message ? error.message : messages.generic });
    } finally {
      if (requestRef.current === request && userIdRef.current === expectedUserId) setBusy(false);
    }
  };

  return { name, setName: changeName, savedName, dirty, busy, status, validation, cancel, save };
}
