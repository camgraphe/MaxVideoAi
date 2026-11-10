import {
  claimStorageObjectProducer, renewStorageObjectProducer, settleStorageObjectProducer,
  STORAGE_OBJECT_PRODUCER_LEASE_MS, type StorageObjectProducerClaim,
} from '@/server/storage-object-producer-claims';

export const imageUploadProducerDependencies = {
  claimStorageObjectProducer,
  renewStorageObjectProducer,
  settleStorageObjectProducer,
  scheduleProducerHeartbeat(callback: () => Promise<void>, intervalMs: number): () => void {
    const timer = setInterval(() => { void callback().catch(() => undefined); }, intervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
  },
};

/** Owns the content-key lease from before PUT until the image is persisted. */
export function createImageUploadProducer(
  inputSignal: AbortSignal | undefined,
  dependencies: typeof imageUploadProducerDependencies,
) {
  const controller = new AbortController();
  const signal = inputSignal ? AbortSignal.any([inputSignal, controller.signal]) : controller.signal;
  let claim: StorageObjectProducerClaim | null = null;
  let stopHeartbeat: (() => void) | null = null;
  let renewalTail = Promise.resolve();
  const renew = () => {
    const next = renewalTail.then(async () => {
      signal.throwIfAborted();
      if (claim) claim = await dependencies.renewStorageObjectProducer({ claim });
    }).catch(error => { controller.abort(error); throw error; });
    renewalTail = next.catch(() => undefined);
    return next;
  };
  return {
    signal,
    async acquire(objectKey: string) {
      signal.throwIfAborted();
      claim = await dependencies.claimStorageObjectProducer({ objectKey });
      stopHeartbeat = dependencies.scheduleProducerHeartbeat(renew, Math.floor(STORAGE_OBJECT_PRODUCER_LEASE_MS / 3));
      signal.throwIfAborted();
    },
    async checkpoint() {
      await renew();
      signal.throwIfAborted();
    },
    async release(outcome: 'persisted' | 'abandoned') {
      stopHeartbeat?.();
      stopHeartbeat = null;
      await renewalTail;
      if (claim) await dependencies.settleStorageObjectProducer({ claim, outcome });
      claim = null;
    },
  };
}
