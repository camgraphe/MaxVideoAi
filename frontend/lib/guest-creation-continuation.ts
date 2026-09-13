import { safeInternalReturnTarget } from './auth-return-target';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const KEY = 'maxvideoai:guest-creation:v1';
const TTL = 30 * 60_000;
const MAX_BYTES = 100_000;
export type CreationSurface = '/app' | '/app/image' | '/app/audio';

export function stageGuestCreation(storage: Store, surface: CreationSurface, payload: string, token: string, now = Date.now()) {
  if (!token || payload.length > MAX_BYTES) return false;
  storage.setItem(KEY, JSON.stringify({ surface, payload, token, createdAt: now }));
  return true;
}

export function consumeGuestCreation(storage: Store, surface: CreationSurface, token: string | null, now = Date.now()): string | null {
  if (!token) return null;
  const raw = storage.getItem(KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value.token !== token || value.surface !== surface) return null;
    storage.removeItem(KEY); // Once claimed, no second account can inherit it.
    if (typeof value.createdAt !== 'number' || now < value.createdAt || now - value.createdAt > TTL || typeof value.payload !== 'string' || value.payload.length > MAX_BYTES) return null;
    return value.payload;
  } catch { storage.removeItem(KEY); return null; }
}

/** Called only by a resolved guest workspace; never registers for an account draft. */
export function listenForGuestCreationLogin(surface: CreationSurface, getPayload: () => string | null) {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!anchor || anchor.target === '_blank') return;
    const login = new URL(anchor.href, window.location.href);
    if (login.origin !== window.location.origin || login.pathname !== '/login') return;
    const next = new URL(safeInternalReturnTarget(login.searchParams.get('next')), window.location.origin);
    if (next.pathname !== surface) return;
    try {
      const payload = getPayload();
      if (!payload) return;
      const token = crypto.randomUUID();
      if (!stageGuestCreation(sessionStorage, surface, payload, token)) return;
      // The staged form already includes these settings; rehydrating a job would overwrite edits.
      for (const key of ['job', 'from', 'engine', 'engineId', 'mode', 'reuse']) next.searchParams.delete(key);
      next.searchParams.set('continueDraft', token);
      login.searchParams.set('next', `${next.pathname}${next.search}${next.hash}`);
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(`${login.pathname}${login.search}`);
    } catch { /* Storage unavailable: keep the original feature continuation. */ }
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}

export function consumeGuestCreationFromLocation(surface: CreationSurface) {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('continueDraft');
  try {
    const value = consumeGuestCreation(sessionStorage, surface, token);
    if (token) {
      url.searchParams.delete('continueDraft');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
    return value;
  } catch { return null; }
}
