'use client';

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

type ClarityListener = () => void;

const ENABLE_FLAG = process.env.NEXT_PUBLIC_ENABLE_CLARITY === 'true';
const DEBUG_FLAG = process.env.NEXT_PUBLIC_CLARITY_DEBUG === 'true' && process.env.NODE_ENV !== 'production';
const ALLOWED_HOSTS = (process.env.NEXT_PUBLIC_CLARITY_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter((entry) => entry.length > 0);

let pendingCommands: unknown[][] = [];
let clarityReady = false;
const readyListeners = new Set<ClarityListener>();

function getClarityWindow(): (Window & { clarity?: ClarityFn }) | null {
  if (typeof window === 'undefined') return null;
  return window as Window & { clarity?: ClarityFn };
}

function ensureClarityStub(): ClarityFn | null {
  const clarityWindow = getClarityWindow();
  if (!clarityWindow) return null;
  if (clarityWindow.clarity) {
    return clarityWindow.clarity;
  }

  const stub: ClarityFn = (...args: unknown[]) => {
    (stub.q = stub.q || []).push(args);
  };
  stub.q = stub.q || [];
  clarityWindow.clarity = stub;

  return clarityWindow.clarity;
}

export function queueClarityCommand(...args: unknown[]): void {
  const clarityWindow = getClarityWindow();
  const clarity = clarityWindow?.clarity;
  if (clarity) {
    clarity(...args);
    return;
  }
  pendingCommands.push(args);
}

export function flushPendingClarityCommands(): void {
  const clarity = ensureClarityStub();
  if (!clarity) return;
  if (pendingCommands.length === 0) return;
  pendingCommands.forEach((command) => {
    clarity(...command);
  });
  pendingCommands = [];
}

export function markClarityReady(): void {
  clarityReady = true;
  flushPendingClarityCommands();
  readyListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[clarity] listener failed', error);
      }
    }
  });
}

export function onClarityReady(listener: ClarityListener): () => void {
  if (clarityReady) {
    listener();
    return () => {};
  }
  readyListeners.add(listener);
  return () => {
    readyListeners.delete(listener);
  };
}

export function isClarityReady(): boolean {
  return clarityReady;
}

export function isClarityDebugEnabled(): boolean {
  return DEBUG_FLAG;
}

export function isClarityEnabledForRuntime(): boolean {
  if (!ENABLE_FLAG) return false;
  if (process.env.NODE_ENV !== 'production') return false;
  if (typeof window === 'undefined') return false;
  if (ALLOWED_HOSTS.length === 0) {
    return true;
  }
  const hostname = window.location.hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
}

export function readClarityCookie(name: '_clck' | '_clsk'): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const entry of cookies) {
    const [key, ...rest] = entry.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export function getClarityDebugState(): { visitorId: string | null; sessionId: string | null } {
  return {
    visitorId: readClarityCookie('_clck'),
    sessionId: readClarityCookie('_clsk'),
  };
}
