'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { loadSupabaseClient } from '@/lib/supabaseClientLoader';
import { getAccountName, updateAccountName, validateAccountName } from '../_lib/account-preferences';

type LoadAccountNameClient = () => Promise<import('../_lib/account-preferences').AccountNameClient>;

export function useAccountNameForm(user: User | null, loadClient: LoadAccountNameClient = loadSupabaseClient) {
  const initialName = getAccountName(user);
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const requestRef = useRef(0);
  const userIdRef = useRef(user?.id ?? null);
  const savingRef = useRef(false);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
    requestRef.current += 1;
    setName(initialName);
    setSavedName(initialName);
    setBusy(false);
    savingRef.current = false;
    setStatus(null);
    // Account metadata events for the same user must not cancel their own save completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const validation = validateAccountName(name);
  const dirty = Boolean(user) && validation.name !== savedName.trim();

  const cancel = () => {
    requestRef.current += 1;
    savingRef.current = false;
    setName(savedName);
    setBusy(false);
    setStatus(null);
  };

  const changeName = (value: string) => {
    setName(value);
    setStatus(null);
  };

  const save = async (messages: { required: string; tooLong: string; generic: string; success: string }) => {
    if (!user || savingRef.current) return;
    if (validation.error) {
      setStatus({ kind: 'error', message: messages[validation.error] });
      return;
    }
    const request = ++requestRef.current;
    const expectedUserId = user.id;
    savingRef.current = true;
    setBusy(true);
    setStatus(null);
    try {
      const client = await loadClient();
      if (requestRef.current !== request || userIdRef.current !== expectedUserId) return;
      const currentUserResult = await client.auth.getUser();
      if (requestRef.current !== request || userIdRef.current !== expectedUserId) return;
      if (currentUserResult.error) throw new Error(currentUserResult.error.message);
      if (currentUserResult.data.user?.id !== expectedUserId) return;
      await updateAccountName(client, expectedUserId, validation.name);
      if (requestRef.current !== request || userIdRef.current !== expectedUserId) return;
      setName(validation.name);
      setSavedName(validation.name);
      setStatus({ kind: 'success', message: messages.success });
    } catch (error) {
      if (requestRef.current !== request || userIdRef.current !== expectedUserId) return;
      setStatus({ kind: 'error', message: error instanceof Error && error.message ? error.message : messages.generic });
    } finally {
      if (requestRef.current === request && userIdRef.current === expectedUserId) {
        savingRef.current = false;
        setBusy(false);
      }
    }
  };

  return { name, setName: changeName, savedName, dirty, busy, status, validation, cancel, save };
}
