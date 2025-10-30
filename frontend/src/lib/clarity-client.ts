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
const CMP_ANALYTICS_COOKIE = 'cmp_analytics';
const OPT_OUT_STORAGE_KEY = 'mv-clarity-opt-out';
const OPT_OUT_COOKIE = 'mv-clarity-opt-out';

let pendingCommands: unknown[][] = [];
let clarityReady = false;
const readyListeners = new Set<ClarityListener>();
let cachedVisitorId: string | null = null;
let clarityInjected = false;

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
  if (isClarityOptedOut()) return false;
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

function logDebug(...args: unknown[]): void {
  if (!DEBUG_FLAG) return;
  // eslint-disable-next-line no-console
  console.log('[clarity]', ...args);
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

function deleteCookie(name: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const parts = [`${name}=`, 'Path=/', 'Max-Age=0', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'SameSite=Lax'];
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

export function hasAnalyticsConsentCookie(): boolean {
  const value = getCookie(CMP_ANALYTICS_COOKIE);
  return value === 'granted';
}

export function setAnalyticsConsentCookie(granted: boolean): void {
  if (typeof document === 'undefined') return;
  if (!granted) {
    document.cookie = `${CMP_ANALYTICS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }
  writeCookie(CMP_ANALYTICS_COOKIE, 'granted', 60 * 60 * 24 * 400);
}

function readOptOutFlag(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage?.getItem(OPT_OUT_STORAGE_KEY);
      if (stored === 'true' || stored === '1') {
        return true;
      }
    } catch {
      // ignore storage errors
    }
  }
  const cookie = getCookie(OPT_OUT_COOKIE);
  return cookie === 'true' || cookie === '1';
}

function persistOptOutFlag(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    try {
      if (enabled) {
        window.localStorage?.setItem(OPT_OUT_STORAGE_KEY, '1');
      } else {
        window.localStorage?.removeItem(OPT_OUT_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }
  if (enabled) {
    writeCookie(OPT_OUT_COOKIE, '1', 60 * 60 * 24 * 400);
  } else {
    deleteCookie(OPT_OUT_COOKIE);
  }
}

function clearClarityArtifacts(): void {
  if (typeof document !== 'undefined') {
    const scripts = document.querySelectorAll<HTMLScriptElement>('script[src*="clarity.ms/tag/"]');
    scripts.forEach((script) => {
      script.parentNode?.removeChild(script);
    });
  }
  const clarityWindow = getClarityWindow();
  if (clarityWindow) {
    clarityWindow.clarity = undefined;
  }
  pendingCommands = [];
  clarityInjected = false;
  clarityReady = false;
}

export function isClarityOptedOut(): boolean {
  return readOptOutFlag();
}

export function disableClarityForVisitor(): void {
  if (isClarityOptedOut()) return;
  persistOptOutFlag(true);
  setAnalyticsConsentCookie(false);
  setClarityConsent(false);
  clearClarityArtifacts();
}

export function enableClarityForVisitor(): void {
  if (!isClarityOptedOut()) return;
  persistOptOutFlag(false);
}

export function setClarityConsent(granted: boolean): void {
  queueClarityCommand('consent', granted);
  queueClarityCommand('consentv2', {
    ad_Storage: granted ? 'granted' : 'denied',
    analytics_Storage: granted ? 'granted' : 'denied',
  });
  logDebug(`consent -> ${granted ? 'granted' : 'denied'}`);
}

export function injectClarityScript(id: string): void {
  if (clarityInjected) {
    logDebug('inject skip: already injected');
    return;
  }
  const clarityWindow = getClarityWindow();
  if (clarityWindow?.clarity && clarityWindow.clarity.q && clarityWindow.clarity.q?.length >= 0) {
    clarityInjected = true;
    logDebug('inject skip: window.clarity present');
    return;
  }
  if (typeof document === 'undefined') return;

  clarityInjected = true;
  flushPendingClarityCommands();

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${id}`;
  script.dataset.analytics = 'clarity';
  script.addEventListener('load', () => {
    markClarityReady();
    logDebug('script loaded');
  });
  script.addEventListener('error', (error) => {
    clarityInjected = false;
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[clarity] failed to load script', error);
    }
  });

  const firstScript = document.getElementsByTagName('script')[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else if (document.head) {
    document.head.appendChild(script);
  } else {
    document.documentElement.appendChild(script);
  }
  logDebug('script injected', script.src);
}

export function dumpClarity(): void {
  if (typeof document === 'undefined') {
    // eslint-disable-next-line no-console
    console.log('[clarity dump] document unavailable');
    return;
  }
  const cookies = document.cookie ? document.cookie.split(';').map((entry) => entry.trim()) : [];
  const clck = cookies.find((entry) => entry.startsWith('_clck=')) ?? '(none)';
  const clsk = cookies.find((entry) => entry.startsWith('_clsk=')) ?? '(none)';
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="clarity.ms/tag/"]')).map((script) => script.src);
  const clarityWindow = getClarityWindow();
  // eslint-disable-next-line no-console
  console.log('[clarity dump]', {
    _clck: clck,
    _clsk: clsk,
    hasClarity: Boolean(clarityWindow?.clarity),
    pending: pendingCommands.length,
    scripts,
  });
}

if (typeof window !== 'undefined' && DEBUG_FLAG) {
  (window as typeof window & { dumpClarity?: () => void }).dumpClarity = dumpClarity;
}
