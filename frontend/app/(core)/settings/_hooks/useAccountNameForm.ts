'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { loadSupabaseClient } from '@/lib/supabaseClientLoader';
import { getAccountName, updateAccountNameWithToken, validateAccountName } from '../_lib/account-preferences';

type LoadAccountNameClient = () => Promise<import('../_lib/account-preferences').AccountNameClient>;
type UpdateAccountName = typeof updateAccountNameWithToken;

export function useAccountNameForm(user: User | null, dependencies: { loadClient?: LoadAccountNameClient; updateName?: UpdateAccountName } = {}) {
  const loadClient = dependencies.loadClient ?? loadSupabaseClient;
  const updateName = dependencies.updateName ?? updateAccountNameWithToken;
  const initialName = getAccountName(user);
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const requestRef = useRef(0);
  const userIdRef = useRef(user?.id ?? null);
  const savingRef = useRef(false);
  const incomingNameRef = useRef(initialName);
  const nameRef = useRef(name);
  const savedNameRef = useRef(savedName);
  nameRef.current = name;
  savedNameRef.current = savedName;

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
    incomingNameRef.current = initialName;
    requestRef.current += 1;
    setName(initialName);
    setSavedName(initialName);
    setBusy(false);
    savingRef.current = false;
    setStatus(null);
    // Account metadata events for the same user must not cancel their own save completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (userIdRef.current !== (user?.id ?? null) || incomingNameRef.current === initialName) return;
    incomingNameRef.current = initialName;
    if (savingRef.current || nameRef.current.trim() !== savedNameRef.current.trim()) return;
    nameRef.current = initialName;
    savedNameRef.current = initialName;
    setName(initialName);
    setSavedName(initialName);
  }, [initialName, user?.id]);

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
      const sessionResult = await client.auth.getSession();
      if (requestRef.current !== request || userIdRef.current !== expectedUserId) return;
      if (sessionResult.error) throw new Error(sessionResult.error.message);
      const capturedSession = sessionResult.data.session;
      if (!capturedSession || capturedSession.user.id !== expectedUserId) return;
      const currentUserResult = await client.auth.getUser(capturedSession.access_token);
      if (requestRef.current !== request || userIdRef.current !== expectedUserId) return;
      if (currentUserResult.error) throw new Error(currentUserResult.error.message);
      if (currentUserResult.data.user?.id !== expectedUserId) return;
      await updateName({ accessToken: capturedSession.access_token, expectedUserId, name: validation.name });
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
