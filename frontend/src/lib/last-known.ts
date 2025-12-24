type StoredWallet = {
  balance: number;
  currency?: string;
  userId?: string;
  updatedAt: number;
};

type StoredMember = {
  tier?: string;
  spentToday?: number;
  spent30?: number;
  savingsPct?: number;
  userId?: string;
  updatedAt: number;
};

const KEY_USER_ID = 'last-known:user-id';
const KEY_WALLET = 'last-known:wallet';
const KEY_MEMBER = 'last-known:member';

function readStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, value: T | null): void {
  if (typeof window === 'undefined') return;
  if (value === null) {
    window.sessionStorage.removeItem(key);
    return;
  }
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures (quota/private mode).
  }
}

export function readLastKnownUserId(): string | null {
  if (typeof window === 'undefined') return null;
  let value: string | null = null;
  try {
    value = window.sessionStorage.getItem(KEY_USER_ID);
  } catch {
    return null;
  }
  return value && value.trim().length ? value : null;
}

export function writeLastKnownUserId(userId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!userId) {
      window.sessionStorage.removeItem(KEY_USER_ID);
      return;
    }
    window.sessionStorage.setItem(KEY_USER_ID, userId);
  } catch {
    // Ignore storage failures.
  }
}

export function readLastKnownWallet(userId?: string | null): { balance: number; currency?: string } | null {
  const stored = readStorage<StoredWallet>(KEY_WALLET);
  if (!stored || typeof stored.balance !== 'number' || !Number.isFinite(stored.balance)) return null;
  if (userId && stored.userId && stored.userId !== userId) return null;
  return { balance: stored.balance, currency: stored.currency };
}

export function writeLastKnownWallet(
  wallet: { balance: number; currency?: string },
  userId?: string | null
): void {
  if (typeof wallet.balance !== 'number' || !Number.isFinite(wallet.balance)) return;
  writeStorage(KEY_WALLET, {
    balance: wallet.balance,
    currency: wallet.currency,
    userId: userId ?? undefined,
    updatedAt: Date.now(),
  });
}

export function readLastKnownMember(
  userId?: string | null
): { tier?: string; spentToday?: number; spent30?: number; savingsPct?: number } | null {
  const stored = readStorage<StoredMember>(KEY_MEMBER);
  if (!stored) return null;
  if (userId && stored.userId && stored.userId !== userId) return null;
  return {
    tier: stored.tier,
    spentToday: stored.spentToday,
    spent30: stored.spent30,
    savingsPct: stored.savingsPct,
  };
}

export function writeLastKnownMember(
  member: { tier?: string; spentToday?: number; spent30?: number; savingsPct?: number },
  userId?: string | null
): void {
  if (!member) return;
  writeStorage(KEY_MEMBER, {
    tier: member.tier,
    spentToday: member.spentToday,
    spent30: member.spent30,
    savingsPct: member.savingsPct,
    userId: userId ?? undefined,
    updatedAt: Date.now(),
  });
}

export function clearLastKnownAccount(): void {
  writeStorage(KEY_WALLET, null);
  writeStorage(KEY_MEMBER, null);
}
