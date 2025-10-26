'use client';

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

type ClarityListener = () => void;

const ENABLE_FLAG = process.env.NEXT_PUBLIC_ENABLE_CLARITY === 'true';
const DEBUG_FLAG = process.env.NEXT_PUBLIC_CLARITY_DEBUG === 'true' && process.env.NODE_ENV !== 'production';
const ALLOWED_HOSTS = (process.env.NEXT_PUBLIC_CLARITY_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter((entry) => entry.length > 0);
const VISITOR_COOKIE = 'mv-clarity-id';

let pendingCommands: unknown[][] = [];
let clarityReady = false;
const readyListeners = new Set<ClarityListener>();
let cachedVisitorId: string | null = null;

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

function generateVisitorId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

function getCookie(name: string): string | null {
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

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const encoded = encodeURIComponent(value);
  const parts = [`${name}=${encoded}`, 'Path=/', `Max-Age=${maxAgeSeconds}`, 'SameSite=Lax'];
  if (window.location.protocol === 'https:') {
    parts.push('Secure');
  }
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('.')) {
    const domainParts = hostname.split('.');
    if (domainParts.length >= 2) {
      const baseDomain = domainParts.slice(-2).join('.');
      parts.push(`Domain=.${baseDomain}`);
    }
  }
  document.cookie = parts.join('; ');
}

export function ensureClarityVisitorId(): string | null {
  if (cachedVisitorId) return cachedVisitorId;
  if (typeof window === 'undefined') return null;
  const existing = getCookie(VISITOR_COOKIE);
  if (existing && existing.length >= 10) {
    cachedVisitorId = existing;
    return cachedVisitorId;
  }
  const generated = generateVisitorId();
  writeCookie(VISITOR_COOKIE, generated, 60 * 60 * 24 * 400);
  cachedVisitorId = generated;
  return cachedVisitorId;
}

export function getCachedVisitorId(): string | null {
  return cachedVisitorId;
}
