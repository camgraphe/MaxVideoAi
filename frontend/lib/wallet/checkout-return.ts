export type WalletCheckoutReturnTarget = '/app';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type StorageOptions = {
  storage?: StorageLike;
  now?: number;
};

const STORAGE_KEY = 'mv-wallet-checkout-return';
const MAX_AGE_MS = 60 * 60 * 1000;

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isAllowedTarget(value: unknown): value is WalletCheckoutReturnTarget {
  return value === '/app';
}

export function persistPendingWalletCheckoutReturn(
  target: string,
  options: StorageOptions = {}
): boolean {
  if (!isAllowedTarget(target)) return false;
  const storage = resolveStorage(options.storage);
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ target, createdAt: options.now ?? Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingWalletCheckoutReturn(options: Pick<StorageOptions, 'storage'> = {}): void {
  const storage = resolveStorage(options.storage);
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Browser storage is an optional conversion aid.
  }
}

export function consumePendingWalletCheckoutReturn(
  options: StorageOptions = {}
): WalletCheckoutReturnTarget | null {
  const storage = resolveStorage(options.storage);
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    storage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { target?: unknown; createdAt?: unknown };
    const createdAt = Number(parsed.createdAt);
    const now = options.now ?? Date.now();
    if (!isAllowedTarget(parsed.target)) return null;
    if (!Number.isFinite(createdAt) || createdAt > now || now - createdAt > MAX_AGE_MS) return null;
    return parsed.target;
  } catch {
    return null;
  }
}
