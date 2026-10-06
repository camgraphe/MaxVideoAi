'use client';

import { isBrowserCommercialAnalyticsExcluded, COMMERCIAL_ANALYTICS_RESOLVED_EVENT, COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT } from '@/lib/analytics/commercial-client';
import { CLARITY_ANALYTICS_EVENTS } from '@/lib/analytics/clarity-context';

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][]; v?: string };

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
let clarityStopped = false;
let guardedBrowser: Window | null = null;
let injectedProjectId: string | null = null;
let bootstrapConfig: Record<string, unknown> | null = null;
let readinessTimer: number | null = null;

function captureClarityBootstrap(): void {
  // The project tag loads the versioned SDK separately. Preserve its exact
  // start config before discarding queued visitor data during a withdrawal.
  for (const command of getClarityWindow()?.clarity?.q ?? []) {
    const config = command[1];
    if (command[0] === 'start' && config && typeof config === 'object'
      && (config as Record<string, unknown>).projectId === injectedProjectId) {
      bootstrapConfig = config as Record<string, unknown>;
    }
  }
}

function waitForClarityDispatcher(attempt = 0): void {
  if (typeof window === 'undefined' || clarityStopped) return;
  captureClarityBootstrap();
  if (getClarityWindow()?.clarity?.v) { markClarityReady(); return; }
  if (attempt < 50 && readinessTimer === null) readinessTimer = window.setTimeout(() => {
    readinessTimer = null;
    waitForClarityDispatcher(attempt + 1);
  }, 200);
}

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
  if (args[0] !== 'consentv2' && (!isClarityEnabledForRuntime() || !hasAnalyticsConsentCookie() || clarityStopped)) return;
  const clarityWindow = getClarityWindow();
  const clarity = clarityWindow?.clarity;
  if (clarity) {
    clarity(...args);
    return;
  }
  if (pendingCommands.length < 100) pendingCommands.push(args);
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
  if (!getClarityWindow()?.clarity?.v) return;
  if (clarityStopped || isBrowserCommercialAnalyticsExcluded() || !hasAnalyticsConsentCookie()) {
    stopClarityRecording();
    return;
  }
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
  if (isBrowserCommercialAnalyticsExcluded()) return false;
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
  document.cookie = parts.join('; '); // Host-only cookies.
  const domainParts = window.location.hostname.toLowerCase().split('.');
  for (let index = 0; index < domainParts.length - 1; index += 1) {
    document.cookie = [...parts, `Domain=.${domainParts.slice(index).join('.')}`].join('; ');
  }
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

export function stopClarityRecording(): void {
  captureClarityBootstrap();
  if (readinessTimer !== null && typeof window !== 'undefined') window.clearTimeout(readinessTimer);
  readinessTimer = null;
  const clarityWindow = getClarityWindow();
  const clarity = clarityWindow?.clarity;
  const loaded = Boolean(clarity?.v);
  if (clarity?.q) clarity.q.length = 0;
  // consentv2 denial schedules a vendor restart. Stop directly, then clear its
  // replacement queue so late commands cannot restart an excluded recording.
  if (clarity && clarityInjected) clarity('stop');
  const stoppedClarity = getClarityWindow()?.clarity;
  // Before asynchronous SDK initialization, retain the queued stop. Once loaded,
  // stop has already replaced the dispatcher; its stale queue must be discarded.
  if (loaded && stoppedClarity?.q) stoppedClarity.q.length = 0;
  ['_clck', '_clsk', VISITOR_COOKIE].forEach(deleteCookie);
  cachedVisitorId = null;
  pendingCommands = [];
  clarityStopped = true;
  clarityReady = false;
}

function installClarityGuards(): void {
  if (typeof window === 'undefined' || guardedBrowser === window) return;
  guardedBrowser = window;
  const stopIfExcluded = () => {
    if (isBrowserCommercialAnalyticsExcluded()) stopClarityRecording();
  };
  window.addEventListener(COMMERCIAL_ANALYTICS_RESOLVED_EVENT, stopIfExcluded);
  window.addEventListener(COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT, stopIfExcluded);
  window.addEventListener('consent:updated', (event) => {
    const detail = (event as CustomEvent<{ categories?: { analytics?: boolean; ads?: boolean } }>).detail;
    if (detail?.categories?.analytics === false) stopClarityRecording();
    else if (detail?.categories) setClarityConsent(Boolean(detail.categories.analytics), Boolean(detail.categories.ads));
  });
}

export function isClarityOptedOut(): boolean {
  return readOptOutFlag();
}

export function disableClarityForVisitor(): void {
  if (isClarityOptedOut()) return;
  persistOptOutFlag(true);
  setAnalyticsConsentCookie(false);
  setClarityConsent(false);
  stopClarityRecording();
}

export function enableClarityForVisitor(): void {
  if (!isClarityOptedOut()) return;
  persistOptOutFlag(false);
}

export function setClarityConsent(granted: boolean, adsGranted = false): void {
  if (clarityStopped || isBrowserCommercialAnalyticsExcluded() || isClarityOptedOut()) return;
  queueClarityCommand('consentv2', {
    ad_Storage: adsGranted ? 'granted' : 'denied',
    analytics_Storage: granted ? 'granted' : 'denied',
  });
  logDebug(`consent -> ${granted ? 'granted' : 'denied'}`);
}

export function injectClarityScript(id: string): void {
  if (!isClarityEnabledForRuntime() || !hasAnalyticsConsentCookie()) return;
  installClarityGuards();
  if (clarityInjected) {
    if (clarityStopped) {
      clarityStopped = false;
      captureClarityBootstrap();
      const clarity = getClarityWindow()?.clarity;
      if (clarity?.q) clarity.q.length = 0;
      if (bootstrapConfig) clarity?.('start', bootstrapConfig);
      else clarity?.('start');
      waitForClarityDispatcher();
    }
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
  injectedProjectId = id;
  clarityStopped = false;
  flushPendingClarityCommands();

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${id}`;
  script.dataset.analytics = 'clarity';
  script.addEventListener('load', () => {
    captureClarityBootstrap();
    if (clarityStopped || isBrowserCommercialAnalyticsExcluded() || !hasAnalyticsConsentCookie()) stopClarityRecording();
    else waitForClarityDispatcher();
    logDebug('project tag loaded');
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

/** Names only, after canonical consent, role resolution and journey deduplication. */
export function recordClarityAnalyticsEvent(event: string): void {
  if (!CLARITY_ANALYTICS_EVENTS.has(event) || !isClarityEnabledForRuntime() || !hasAnalyticsConsentCookie() || clarityStopped) return;
  // No second buffer and no SDK initialization on private entry pages.
  if (!getClarityWindow()?.clarity) return;
  queueClarityCommand('event', `mvai_${event}`);
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
