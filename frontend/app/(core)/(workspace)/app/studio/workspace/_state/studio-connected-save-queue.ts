export type StudioConnectedSaveStatus = 'ready' | 'unauthorized' | 'unavailable' | 'conflict' | 'error';

type SaveResult = { status: StudioConnectedSaveStatus; revision?: number };

export function createStudioConnectedSaveQueue<TSnapshot>(options: {
  scope: string;
  initialRevision: number;
  initialConflictDraft?: TSnapshot;
  save(request: { scope: string; expectedRevision: number; snapshot: TSnapshot }): Promise<SaveResult>;
  onRevision?: (revision: number) => void;
  onSaved?: (snapshot: TSnapshot, revision: number) => void;
  onConflict?: (draft: TSnapshot, revision: number) => void;
}) {
  let revision = options.initialRevision;
  let pending: TSnapshot | null = options.initialConflictDraft ?? null;
  let latestDraft: TSnapshot | null = options.initialConflictDraft ?? null;
  let inFlight = false;
  let blockedByConflict = options.initialConflictDraft !== undefined;
  let disposed = false;
  let lastStatus: StudioConnectedSaveStatus = blockedByConflict ? 'conflict' : 'ready';
  let waiters: Array<(status: StudioConnectedSaveStatus) => void> = [];

  const settle = (status: StudioConnectedSaveStatus) => {
    const current = waiters;
    waiters = [];
    current.forEach((resolve) => resolve(status));
  };

  const drain = async () => {
    if (inFlight || blockedByConflict || disposed || pending === null) return;
    const snapshot = pending;
    pending = null;
    inFlight = true;
    const result = await options.save({ scope: options.scope, expectedRevision: revision, snapshot });
    inFlight = false;
    if (disposed) return;
    lastStatus = result.status;
    if (result.status === 'ready' && Number.isSafeInteger(result.revision) && (result.revision ?? -1) > revision) {
      revision = result.revision!;
      options.onRevision?.(revision);
      options.onSaved?.(snapshot, revision);
      if (pending !== null) void drain();
      else settle('ready');
      return;
    }
    if (result.status === 'conflict') {
      blockedByConflict = true;
      pending = latestDraft ?? snapshot;
      options.onConflict?.(pending, revision);
      settle('conflict');
      return;
    }
    pending = latestDraft ?? snapshot;
    settle(result.status === 'ready' ? 'error' : result.status);
  };

  return {
    enqueue(snapshot: TSnapshot) {
      if (disposed) return;
      latestDraft = snapshot;
      pending = snapshot;
      void drain();
    },
    whenIdle(): Promise<StudioConnectedSaveStatus> {
      if (disposed) return Promise.resolve('error');
      if (!inFlight && (pending === null || blockedByConflict)) return Promise.resolve(lastStatus);
      return new Promise((resolve) => waiters.push(resolve));
    },
    draft: () => latestDraft,
    state: () => ({ blockedByConflict, inFlight, revision }),
    dispose() {
      disposed = true;
      pending = null;
      lastStatus = 'error';
      settle('error');
    },
  };
}

export type StudioConnectedSaveQueue<TSnapshot> = ReturnType<typeof createStudioConnectedSaveQueue<TSnapshot>>;
