import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { Session } from '@supabase/supabase-js';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

export function sessionFor(id = 'account-a', token = 'synthetic-token-a'): Session {
  return {
    access_token: token, refresh_token: `synthetic-refresh-${id}`, token_type: 'bearer', expires_in: 3600,
    user: { id, email: `${id}@example.test`, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {} },
  };
}

type AuthListener = (event: string, session: Session | null) => unknown;
type SessionResult = { data: { session: Session | null }; error: null };
type UserResult = { data: { user: Session['user'] | null }; error: null | { code: string } };

// External identity and network boundaries are synthetic. Hooks, legal components,
// session cleanup, storage and DOM state transitions remain the production code.
export async function loadAuthLegalClients() {
  const directory = await mkdtemp(join(tmpdir(), 'auth-legal-clients-'));
  const output = join(directory, 'clients.cjs');
  const require = createRequire(import.meta.url);
  const frontendRequire = createRequire(resolve('frontend/package.json'));
  const boundaries: Record<string, string> = {
    '@/lib/supabaseClient': 'export const supabase = { auth: globalThis.__authLegalFixture.auth };',
    'next/navigation': `const router={replace(path){globalThis.__authLegalFixture.redirects.push(path)},refresh(){}};const params=new URLSearchParams();export const useRouter=()=>router;export const useSearchParams=()=>params;export const usePathname=()=>window.location.pathname;`,
    '@/lib/clarity-client': `export const disableClarityForVisitor=()=>{};export const enableClarityForVisitor=()=>{};export const ensureClarityVisitorId=()=>null;export const isClarityEnabledForRuntime=()=>false;export const queueClarityCommand=()=>{};export const setAnalyticsConsentCookie=()=>{};export const setClarityConsent=()=>{};`,
  };
  await build({
    stdin: { contents: `export {useRequireAuth} from './frontend/src/hooks/useRequireAuth';export {useHeaderAccountState} from './frontend/components/header/useHeaderAccountState';export {ReconsentPrompt} from './frontend/components/legal/ReconsentPrompt';export {CookieBanner} from './frontend/components/legal/CookieBanner';`, resolveDir: process.cwd() },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
    packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'controlled-auth-boundary', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        if (args.path in boundaries) return { path: args.path, namespace: 'controlled' };
        if (args.path === 'react' || args.path.startsWith('react/')) return { path: require.resolve(args.path), external: true };
        if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/')) return { path: frontendRequire.resolve(args.path), external: true };
      });
      builder.onLoad({ filter: /.*/, namespace: 'controlled' }, args => ({ contents: boundaries[args.path], loader: 'js' }));
    } }],
  });
  return {
    // Resolve after DOM/adapter installation; the auth module is lazy as in production.
    load: () => require(output) as {
      useRequireAuth: typeof import('../../frontend/src/hooks/useRequireAuth').useRequireAuth;
      useHeaderAccountState: typeof import('../../frontend/components/header/useHeaderAccountState').useHeaderAccountState;
      ReconsentPrompt: typeof import('../../frontend/components/legal/ReconsentPrompt').ReconsentPrompt;
      CookieBanner: typeof import('../../frontend/components/legal/CookieBanner').CookieBanner;
    },
    dispose: () => rm(directory, { recursive: true, force: true }),
  };
}

export function installAuthLegalFixture(hint = 'account-a') {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.test/billing', pretendToBeVisual: true });
  if (hint) dom.window.sessionStorage.setItem('last-known:user-id', hint);
  const sessions: ReturnType<typeof deferred<SessionResult>>[] = [];
  const users: ReturnType<typeof deferred<UserResult>>[] = [];
  const refreshes: ReturnType<typeof deferred<SessionResult>>[] = [];
  const listeners = new Set<AuthListener>();
  const requests: Array<{ url: string; init?: RequestInit } & ReturnType<typeof deferred<Response>>> = [];
  const redirects: string[] = [];
  const timeouts = new Map<number, { callback: () => void; delay: number }>();
  let timerId = 0;
  dom.window.setTimeout = ((callback: () => void, delay: number) => {
    timeouts.set(++timerId, { callback, delay });
    return timerId;
  }) as typeof dom.window.setTimeout;
  dom.window.clearTimeout = (id) => { timeouts.delete(id); };
  const auth = {
    getSession: () => { const request = deferred<SessionResult>(); sessions.push(request); return request.promise; },
    getUser: () => { const request = deferred<UserResult>(); users.push(request); return request.promise; },
    refreshSession: () => { const request = deferred<SessionResult>(); refreshes.push(request); return request.promise; },
    onAuthStateChange: (listener: AuthListener) => {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    },
    signOut: async () => ({ error: null }),
  };
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, CustomEvent: dom.window.CustomEvent,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    __authLegalFixture: { auth, redirects }, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string, init?: RequestInit) => {
      assert.ok(url.startsWith('/api/'), `External request prohibited: ${url}`);
      const request = { url, init, ...deferred<Response>() }; requests.push(request); return request.promise;
    },
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  return {
    container, requests, sessions, users, refreshes, listeners, redirects, timeouts,
    render: async (element: React.ReactNode) => { await act(async () => root.render(element)); },
    session: async (index: number, session: Session | null) => { await act(async () => sessions[index].resolve({ data: { session }, error: null })); },
    user: async (index: number, session: Session) => { await act(async () => users[index].resolve({ data: { user: session.user }, error: null })); },
    emit: async (event: string, session: Session | null) => {
      await act(async () => { for (const listener of listeners) void listener(event, session); });
    },
    respond: async (index: number, body: unknown, status = 200) => { await act(async () => requests[index].resolve(Response.json(body, { status }))); },
    focus: async () => { await act(async () => dom.window.dispatchEvent(new dom.window.Event('focus'))); },
    invalidateWallet: async () => { await act(async () => dom.window.dispatchEvent(new dom.window.Event('wallet:invalidate'))); },
    expireLookups: async () => {
      await act(async () => {
        for (const [id, timer] of [...timeouts]) if (timer.delay === 4000) { timeouts.delete(id); timer.callback(); }
      });
    },
    async dispose() {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}
