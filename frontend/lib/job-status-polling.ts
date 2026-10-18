import type { JobStatusResult, JobStatusScope } from './api-job-status';

type Entry = {
  key: string;
  principal: string;
  jobId: string;
  owners: Map<symbol, () => boolean>;
  read: (jobId: string, scope: JobStatusScope) => Promise<JobStatusResult>;
  timer: number | null;
  inFlight: boolean;
  failures: number;
  stopped: 'terminal' | 'denied' | 'exhausted' | null;
};
const entries = new Map<string, Entry>();
const permanentErrors = new Set([401, 403, 404]);

function clearTimer(entry: Entry) {
  if (entry.timer !== null) window.clearTimeout(entry.timer);
  entry.timer = null;
}
function isLive(entry: Entry) {
  return entries.get(entry.key) === entry && [...entry.owners.values()].some(isCurrent => isCurrent());
}
function stop(entry: Entry, reason: Entry['stopped']) {
  clearTimer(entry);
  entry.stopped = reason;
}
function isTerminal(result: Pick<JobStatusResult, 'status' | 'outputPreparationState'>) {
  return result.status === 'completed' || result.status === 'failed' || result.outputPreparationState === 'manual_review';
}
function schedule(entry: Entry) {
  if (!isLive(entry) || entry.stopped || entry.inFlight || entry.timer !== null) return;
  const delay = Math.min(15_000 * 2 ** entry.failures, 60_000);
  entry.timer = window.setTimeout(() => {
    entry.timer = null;
    if (!isLive(entry)) return;
    entry.inFlight = true;
    void entry.read(entry.jobId, { principal: entry.principal, isCurrent: () => isLive(entry) }).then(result => {
      if (!isLive(entry)) return;
      entry.failures = 0;
      if (isTerminal(result)) stop(entry, 'terminal');
    }).catch((error: unknown) => {
      if (!isLive(entry)) return;
      const status = error && typeof error === 'object' ? (error as { status?: number }).status : undefined;
      if (status !== undefined && permanentErrors.has(status)) stop(entry, 'denied');
      else if (++entry.failures >= 5) stop(entry, 'exhausted');
    }).finally(() => {
      entry.inFlight = false;
      schedule(entry);
    });
  }, delay);
}

/** One shared timer per account/job; each feed releases only its own subscriptions. */
export function createJobStatusPollingOwner(principal: string, read: Entry['read'], isCurrent: () => boolean) {
  const owner = Symbol('jobs-feed');
  const owned = new Map<string, Entry>();
  let disposed = false;
  const release = (jobId: string, entry: Entry) => {
    owned.delete(jobId);
    entry.owners.delete(owner);
    if (!entry.owners.size) {
      clearTimer(entry);
      if (entries.get(entry.key) === entry) entries.delete(entry.key);
    }
  };
  return {
    has: (jobId: string) => !disposed && owned.has(jobId),
    sync(pendingIds: ReadonlySet<string>, terminalIds: ReadonlySet<string>) {
      if (disposed) return;
      for (const id of terminalIds) {
        const entry = entries.get(JSON.stringify([principal, id]));
        if (entry) stop(entry, 'terminal');
      }
      for (const [id, entry] of owned) if (!pendingIds.has(id)) release(id, entry);
      for (const jobId of pendingIds) {
        const key = JSON.stringify([principal, jobId]);
        let entry = entries.get(key);
        if (!entry) {
          entry = {key, principal, jobId, read, owners: new Map(), timer: null, inFlight: false, failures: 0, stopped: null};
          entries.set(key, entry);
        }
        entry.owners.set(owner, isCurrent);
        owned.set(jobId, entry);
        schedule(entry);
      }
    },
    resume(reason: 'manual' | 'session') {
      if (disposed) return;
      for (const entry of owned.values()) {
        if (!isLive(entry) || !entry.stopped || entry.stopped === 'terminal') continue;
        if (reason === 'session' && entry.stopped !== 'denied') continue;
        entry.failures = 0;
        entry.stopped = null;
        schedule(entry);
      }
    },
    observe(result: JobStatusResult) {
      const entry = owned.get(result.jobId);
      if (!entry || !isLive(entry)) return;
      if (isTerminal(result)) stop(entry, 'terminal');
      else if (entry.stopped !== 'terminal') {
        // A fresh successful observation can recover a stopped outage or renewed session.
        entry.failures = 0;
        entry.stopped = null;
        schedule(entry);
      }
    },
    error(jobId: string, status?: number) {
      const entry = owned.get(jobId);
      if (entry && status !== undefined && permanentErrors.has(status)) stop(entry, 'denied');
    },
    dispose() {
      disposed = true;
      for (const [id, entry] of owned) release(id, entry);
    },
  };
}
