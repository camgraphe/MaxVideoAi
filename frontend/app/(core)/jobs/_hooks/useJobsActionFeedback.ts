'use client';

import { useLayoutEffect, useRef, useState } from 'react';

export type JobsMutationAction = 'save' | 'remove';
export type JobsActionFeedback = {
  groupId: string;
  label: string;
  action: JobsMutationAction;
  status: 'pending' | 'success' | 'error';
};
type MutationEntry = Omit<JobsActionFeedback, 'status'>;
type MutationWork = (isCurrent: () => boolean) => Promise<void>;
type RetryTarget = { entry: MutationEntry; work: MutationWork };

/** Notices follow the visible feed; pending locks survive filters for the same account. */
export function useJobsActionFeedback(userId: string | null, source: string) {
  const key = JSON.stringify([userId, source]);
  const pendingByOwner = useRef(new Map<string, Set<string>>());
  const current = useRef<{ key: string; alive: boolean; retries: Map<string, RetryTarget> } | null>(null);
  if (!current.current || current.current.key !== key) {
    if (current.current) current.current.alive = false;
    current.current = { key, alive: true, retries: new Map() };
  }
  const scope = current.current;
  const isCurrent = () => current.current === scope && scope.alive;
  useLayoutEffect(() => {
    scope.alive = true;
    return () => { scope.alive = false; };
  }, [scope]);
  const [state, setState] = useState<{ scope: typeof scope; entries: JobsActionFeedback[] }>({ scope, entries: [] });
  const feedback = state.scope === scope ? state.entries : [];

  const publish = (entry: JobsActionFeedback) => {
    if (!isCurrent()) return;
    setState(previous => ({ scope, entries: [
      ...(previous.scope === scope ? previous.entries.filter(item => item.groupId !== entry.groupId) : []),
      entry,
    ] }));
  };
  const run = async (
    entry: MutationEntry,
    work: MutationWork,
  ) => {
    if (!userId || !isCurrent()) return;
    const pending = pendingByOwner.current.get(userId) ?? new Set<string>();
    if (pending.has(entry.groupId)) return;
    pendingByOwner.current.set(userId, pending);
    pending.add(entry.groupId);
    scope.retries.delete(entry.groupId);
    publish({ ...entry, status: 'pending' });
    try {
      await work(isCurrent);
      publish({ ...entry, status: 'success' });
    } catch {
      if (isCurrent()) scope.retries.set(entry.groupId, { entry, work });
      publish({ ...entry, status: 'error' });
    } finally {
      pending.delete(entry.groupId);
      if (!pending.size) pendingByOwner.current.delete(userId);
    }
  };
  const dismiss = (groupId: string) => {
    if (!isCurrent() || (userId && pendingByOwner.current.get(userId)?.has(groupId))) return;
    scope.retries.delete(groupId);
    setState(previous => previous.scope === scope
      ? { scope, entries: previous.entries.filter(entry => entry.groupId !== groupId) } : previous);
  };
  const retry = (groupId: string, action: JobsMutationAction) => {
    const target = scope.retries.get(groupId);
    if (target?.entry.action === action) void run(target.entry, target.work);
  };
  return { feedback, run, dismiss, retry };
}
