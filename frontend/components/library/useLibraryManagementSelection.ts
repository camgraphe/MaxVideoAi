'use client';
import { useEffect, useRef, useState } from 'react';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import { mutateLibraryOrganization } from '@/lib/library-mutations';
import type {
  LibraryBrowseScope,
  LibrarySelectionSnapshot,
  LibrarySnapshotMutationResult,
} from '@/lib/library-browse';
import type { LibraryOrganizationOperation } from '@/lib/media-library-organization';
import {
  changeLoadedSelection,
  emptyManagementSelection,
  frozenManagementSelection,
  runManualOrganization,
  selectedManagementKeys,
  selectionCount,
  type ManagedLibraryAsset,
  type ManualOrganizationOutcome,
} from '@/lib/library-management-selection';
export function useLibraryManagementSelection({
  userId,
  scope,
  assets,
}: {
  userId: string;
  scope: LibraryBrowseScope;
  assets: ManagedLibraryAsset[];
}) {
  const identity = JSON.stringify([userId, { ...scope, sort: undefined }]);
  const context = useRef({ identity });
  if (context.current.identity !== identity) context.current = { identity };
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [state, setState] = useState(() => ({ identity, selection: emptyManagementSelection() }));
  const [announcement, setAnnouncement] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef<object | null>(null);
  const [globalUnconfirmedCount, setGlobalUnconfirmedCount] = useState(0);
  const [globalOutcome, setGlobalOutcome] = useState<LibrarySnapshotMutationResult | null>(null);
  const [outcome, setOutcome] = useState<ManualOrganizationOutcome | null>(null);
  const [lastAction, setLastAction] = useState<{
    operation: LibraryOrganizationOperation;
    collectionId?: string;
    single: boolean;
  } | null>(null);
  const scopeCurrent = state.identity === identity;
  const selection = scopeCurrent ? state.selection : emptyManagementSelection();
  useEffect(() => {
    if (state.identity !== identity) {
      setState({ identity, selection: emptyManagementSelection() });
      setAnnouncement('SELECTION_RESET');
      setError(null);
      setPending(false);
      setOutcome(null);
      setGlobalOutcome(null);
      setGlobalUnconfirmedCount(0);
      setLastAction(null);
    }
  }, [identity, state.identity]);
  const current = (captured: typeof context.current) =>
    alive.current && context.current === captured;
  const change = (keys: ReadonlySet<string> | 'all') => {
    if (pending) return;
    setOutcome(null);
    setGlobalOutcome(null);
    setGlobalUnconfirmedCount(0);
    setLastAction(null);
    try {
      setState({ identity, selection: changeLoadedSelection(selection, assets, keys) });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const selectAllResults = async () => {
    if (inFlight.current === context.current) return;
    const captured = context.current;
    inFlight.current = captured;
    setPending(true);
    setError(null);
    setOutcome(null);
    setGlobalOutcome(null);
    setGlobalUnconfirmedCount(0);
    try {
      const response = await ownedAuthFetch('/api/media-library/selection', userId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? 'SELECTION_FAILED');
      if (current(captured))
        setState({
          identity,
          selection: frozenManagementSelection(body.snapshot as LibrarySelectionSnapshot),
        });
    } catch (e) {
      if (current(captured)) setError((e as Error).message);
    } finally {
      if (inFlight.current === captured) inFlight.current = null;
      if (current(captured)) setPending(false);
    }
  };
  const run = async (
    operation: LibraryOrganizationOperation,
    collectionId?: string,
    retry = false,
    only?: ManagedLibraryAsset[]
  ) => {
    if (inFlight.current === context.current) return null;
    const captured = context.current;
    inFlight.current = captured;
    setPending(true);
    setError(null);
    setLastAction({ operation, collectionId, single: Boolean(only) });
    let submittedSnapshot = false;
    setGlobalUnconfirmedCount(0);
    try {
      if (selection.snapshot && !only) {
        if (Date.parse(selection.snapshot.expiresAt) <= Date.now())
          throw new Error('SNAPSHOT_EXPIRED');
        submittedSnapshot = true;
        const result = await mutateLibraryOrganization(userId, {
          operation,
          collectionId,
          snapshotId: selection.snapshot.id,
          excludedKeys: [...selection.excluded],
        });
        if (current(captured) && 'succeededKeys' in result) {
          setGlobalOutcome(result);
          setState({
            identity,
            selection: {
              ...selection,
              excluded: new Set([...selection.excluded, ...result.succeededKeys]),
            },
          });
          setAnnouncement(`${result.succeededCount}:CONFIRMED:${result.failedCount}:FAILED`);
          if (result.failedCount) setError(result.error ?? 'PARTIAL_FAILURE');
        }
        return result;
      }
      const records =
        only ??
        (retry && outcome
          ? [...outcome.failed.map((f) => f.asset), ...outcome.unconfirmed, ...outcome.unattempted]
          : [...selection.records.values()]);
      const result = await runManualOrganization({
        userId,
        records,
        operation,
        collectionId,
        isCurrent: () => current(captured),
      });
      if (current(captured)) {
        const aggregate =
          retry && outcome
            ? { ...result, confirmed: [...outcome.confirmed, ...result.confirmed] }
            : result;
        setOutcome(aggregate);
        if (!only) {
          const records = new Map(selection.records);
          for (const asset of result.confirmed) records.delete(asset.organization.key);
          setState({ identity, selection: { ...selection, records } });
        }
        setAnnouncement(
          `${aggregate.confirmed.length}:CONFIRMED:${result.failed.length}:FAILED:${result.unconfirmed.length}:UNCONFIRMED:${result.unattempted.length}:UNATTEMPTED`
        );
      }
      return result;
    } catch (e) {
      if (current(captured)) {
        const code = (e as Error).message;
        setError(code);
        if (
          submittedSnapshot &&
          !/^(SNAPSHOT_|INVALID_|COLLECTION_NOT_FOUND|UNAUTHORIZED)/.test(code)
        )
          setGlobalUnconfirmedCount(selectionCount(selection));
      }
      return null;
    } finally {
      if (inFlight.current === captured) inFlight.current = null;
      if (current(captured)) setPending(false);
    }
  };
  return {
    selection,
    count: selectionCount(selection),
    keys: selectedManagementKeys(selection, assets),
    change,
    selectLoaded: () => {
      if (pending) return;
      if (!selection.snapshot) {
        change('all');
        return;
      }
      try {
        const next = changeLoadedSelection(emptyManagementSelection(), assets, 'all');
        setState({ identity, selection: next });
        setOutcome(null);
        setGlobalOutcome(null);
        setGlobalUnconfirmedCount(0);
        setLastAction(null);
        setError(null);
      } catch (error) {
        setError((error as Error).message);
      }
    },
    selectAllResults,
    clear: () => {
      if (!pending) {
        setState({ identity, selection: emptyManagementSelection() });
        setOutcome(null);
        setGlobalOutcome(null);
        setGlobalUnconfirmedCount(0);
        setLastAction(null);
        setError(null);
      }
    },
    run,
    retry: () =>
      scopeCurrent &&
      lastAction &&
      run(
        lastAction.operation,
        lastAction.collectionId,
        true,
        lastAction.single && outcome
          ? [...outcome.failed.map((f) => f.asset), ...outcome.unconfirmed, ...outcome.unattempted]
          : undefined
      ),
    outcome: scopeCurrent ? outcome : null,
    globalOutcome: scopeCurrent ? globalOutcome : null,
    globalUnconfirmedCount: scopeCurrent ? globalUnconfirmedCount : 0,
    pending: scopeCurrent && pending,
    error: scopeCurrent ? error : null,
    announcement: scopeCurrent ? announcement : 'SELECTION_RESET',
  };
}
