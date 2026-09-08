import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import {
  decodeWorkspaceModelSetups,
  workspaceModelSetupsKey,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-setups';
import type { WorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-candidate';
import type { useWorkspaceModelReview } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceModelReview';
const require = createRequire(import.meta.url);
require.extensions['.css'] = (module) => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
};
async function mount({
  storageUnavailable = false,
  readUnavailableOnly = false,
  stored = null as string | null,
  locale = 'en',
} = {}) {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://maxvideoai-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app', pretendToBeVisual: true });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{
    resolve: (response: Response) => void;
    reject: (error: Error) => void;
    body: unknown;
  }> = [];
  const storage = dom.window.sessionStorage;
  if (stored !== null) storage.setItem(workspaceModelSetupsKey('a'), stored);
  const storageApi = readUnavailableOnly
    ? {
        getItem() {
          throw new Error('read unavailable');
        },
        setItem: storage.setItem.bind(storage),
      }
    : storageUnavailable
      ? {
          getItem() {
            throw new Error('unavailable');
          },
          setItem() {
            throw new Error('unavailable');
          },
        }
      : storage;
  for (const [key, value] of Object.entries({
    React,
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    sessionStorage: storageApi,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
    BroadcastChannel: undefined,
    fetch: (url: string, init: RequestInit) => {
      assert.equal(url, '/api/preflight');
      return new Promise<Response>((resolve, reject) =>
        requests.push({ resolve, reject, body: JSON.parse(String(init.body)) }),
      );
    },
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  Object.defineProperty(dom.window.HTMLElement.prototype, 'getClientRects', {
    value() {
      return [{ width: 100, height: 44 }];
    },
  });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.matchMedia = () =>
    ({ matches: false, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;
  const { useWorkspaceModelReview: useReview } = await import(
    '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceModelReview'
  );
  const { WorkspaceModelReview } = await import(
    '../frontend/app/(core)/(workspace)/app/_components/WorkspaceModelReview.client'
  );
  const { WorkspaceModelReviewCommands } = await import(
    '../frontend/app/(core)/(workspace)/app/_components/WorkspaceModelReviewCommands'
  );
  const { I18nProvider } = await import('../frontend/lib/i18n/I18nProvider');
  const engines = listFalEngines()
    .filter((e) => ['seedance-2-0', 'veo-3-1', 'kling-3-pro', 'ltx-2-3'].includes(e.id))
    .map((e) => e.engine);
  let setup: WorkspaceModelSetup = {
    form: coerceFormState(engines.find((e) => e.id === 'seedance-2-0')!, 't2v', null),
    prompt: 'A cinematic scene',
    negativePrompt: '',
    inputAssets: {},
    klingElements: [],
    multiPromptEnabled: false,
    multiPromptScenes: [],
    shotType: 'customize',
    voiceIdsInput: '',
    cfgScale: null,
  };
  let authStatus: 'unknown' | 'refreshing' | 'authed' | 'loggedOut' = 'authed';
  let authRequests = 0;
  let accountId: string | null = 'a',
    accessToken: string | null = 'token-a';
  let current!: ReturnType<typeof useWorkspaceModelReview>;
  const writes: string[] = [];
  const root = createRoot(dom.window.document.getElementById('root')!);
  const setter = (field: keyof WorkspaceModelSetup) => (value: never) => {
    if (!storageUnavailable)
      assert.ok(
        storage.getItem(workspaceModelSetupsKey(accountId!)),
        'snapshot must be persisted before the first setter',
      );
    writes.push(field);
    setup = { ...setup, [field]: value };
  };
  function Fixture() {
    const [, rerender] = React.useReducer((v) => v + 1, 0);
    current = useReview({
      current: setup,
      authStatus,
      onRequestAuth: () => {
        authRequests += 1;
      },
      onGuestEngineChange: (id: string) => {
        setup = { ...setup, form: coerceFormState(engines.find((e) => e.id === id)!, 't2v', setup.form) };
        rerender();
      },
      engines,
      locale,
      accountId,
      accessToken,
      memberTier: 'Member',
      applyPreparedForm: (value) => {
        setter('form')(value as never);
        rerender();
      },
      ...Object.fromEntries(
        [
          'prompt',
          'negativePrompt',
          'inputAssets',
          'klingElements',
          'multiPromptEnabled',
          'multiPromptScenes',
          'shotType',
          'voiceIdsInput',
          'cfgScale',
        ].map((key) => [
          `set${key[0].toUpperCase()}${key.slice(1)}`,
          setter(key as keyof WorkspaceModelSetup),
        ]),
      ),
    } as Parameters<typeof useReview>[0]);
    return React.createElement(I18nProvider, {
      locale: locale as 'en',
      dictionary: {},
      fallback: {},
      children: React.createElement(
        React.Fragment,
        null,
        React.createElement('button', { onClick: () => current.requestModel('veo-3-1') }, 'Choose Veo'),
        React.createElement('button', { onClick: () => current.requestModel('kling-3-pro') }, 'Choose Kling'),
        React.createElement(WorkspaceModelReviewCommands, { review: current, locale }),
        current.panel
          ? React.createElement(WorkspaceModelReview, {
              review: current,
              engines,
              locale,
              currentPrice: 1,
              currentCurrency: 'USD',
              currentPricing: false,
            })
          : null,
      ),
    });
  }
  const render = async () => {
    await act(async () => root.render(React.createElement(Fixture)));
  };
  await render();
  return {
    dom,
    storage,
    requests,
    writes,
    get setup() {
      return setup;
    },
    get authRequests() {
      return authRequests;
    },
    get current() {
      return current;
    },
    async click(label: string) {
      const button = [...dom.window.document.querySelectorAll('button')].find(
        (b) => b.textContent === label || b.getAttribute('aria-label') === label,
      );
      assert.ok(button, label);
      await act(async () => button.click());
    },
    async tick() {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 230));
      });
    },
    async respond(index: number, total = 125) {
      await act(async () =>
        requests[index].resolve(new Response(JSON.stringify({ ok: true, total, currency: 'USD' }))),
      );
    },
    async edit(patch: Partial<WorkspaceModelSetup>) {
      setup = { ...setup, ...patch };
      await render();
    },
    async auth(id: string | null) {
      authStatus = id ? 'authed' : 'loggedOut';
      accountId = id;
      accessToken = id ? `token-${id}` : null;
      await render();
    },
    async pending() {
      authStatus = 'refreshing';
      await render();
    },
    async dispose() {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}
test('rendered Cancel and Escape leave every draft setter untouched and restore focus/scroll', async () => {
  const f = await mount();
  try {
    const opener = f.dom.window.document.querySelector('button')!;
    opener.focus();
    const before = structuredClone(f.setup);
    await f.click('Choose Veo');
    assert.ok(f.dom.window.document.querySelector('[role=dialog]'));
    assert.equal(f.dom.window.document.body.style.overflow, 'hidden');
    await f.click('Cancel');
    assert.deepEqual(f.setup, before);
    assert.deepEqual(f.writes, []);
    assert.equal(f.dom.window.document.activeElement, opener);
    assert.equal(f.dom.window.document.body.style.overflow, '');
    await f.click('Choose Veo');
    await act(async () =>
      f.dom.window.document
        .querySelector('[role=dialog]')!
        .dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    assert.deepEqual(f.writes, []);
  } finally {
    await f.dispose();
  }
});
test('Apply saves before all setters, A to B to C preserves both models, recovery compares the live draft', async () => {
  const f = await mount();
  try {
    const first = f.setup.form.engineId;
    await f.click('Choose Veo');
    assert.equal(f.current.canApply, false);
    await f.tick();
    await f.respond(0);
    assert.equal(f.current.canApply, true);
    assert.match(f.dom.window.document.body.textContent ?? '', /\$1.25/);
    await f.click('Apply model');
    assert.equal(f.setup.form.engineId, 'veo-3-1');
    assert.equal(f.writes.length, 10);
    await f.click('Choose Kling');
    await f.tick();
    await f.respond(1);
    await f.click('Apply model');
    assert.deepEqual(f.current.savedSetups.map((s) => s.modelId).sort(), [first, 'veo-3-1'].sort());
    await act(async () => f.current.selectSavedSetup(first));
    assert.equal(f.current.candidate?.setup.form.engineId, first);
    await f.tick();
    await f.respond(2);
    await f.click('Apply model');
    assert.equal(f.setup.form.engineId, first);
    const entries = decodeWorkspaceModelSetups(f.storage.getItem(workspaceModelSetupsKey('a')), 'a').entries;
    assert.ok(entries['kling-3-pro']);
  } finally {
    await f.dispose();
  }
});
test('draft edits, superseded targets, retry and replaced account invalidate stale actions', async () => {
  const f = await mount();
  try {
    await f.click('Choose Veo');
    await f.tick();
    await f.respond(0);
    const oldApply = f.current.apply;
    await f.edit({ prompt: 'Newer edit' });
    await act(async () => oldApply());
    assert.equal(f.writes.length, 0);
    assert.equal(f.setup.prompt, 'Newer edit');
    await act(async () => f.current.retry());
    const pendingApply = f.current.apply;
    assert.equal(f.current.quote.price, null);
    await act(async () => oldApply());
    assert.equal(f.writes.length, 0);
    await f.tick();
    await f.click('Choose Kling');
    await f.tick();
    await f.respond(1);
    assert.equal(f.current.quote.price, null);
    await f.respond(2);
    const stale = f.current.apply,
      staleOpen = f.current.selectSavedSetup;
    await f.auth('b');
    assert.equal(f.current.panel, null);
    assert.deepEqual(f.current.savedSetups, []);
    await act(async () => {
      stale();
      pendingApply();
      staleOpen('veo-3-1');
    });
    assert.equal(f.writes.length, 0);
    await f.auth(null);
    assert.equal(f.current.available, false);
    assert.equal(f.current.panel, null);
  } finally {
    await f.dispose();
  }
});
test('storage failure preserves in memory, explicit removal only removes the saved snapshot', async () => {
  const f = await mount({ storageUnavailable: true });
  try {
    await f.click('Choose Veo');
    await f.tick();
    await f.respond(0);
    await f.click('Apply model');
    assert.equal(f.current.memoryOnly, true);
    assert.equal(f.current.savedSetups.length, 1);
    const before = structuredClone(f.setup);
    const count = f.writes.length;
    const id = f.current.savedSetups[0].modelId;
    await act(async () => f.current.open('saved'));
    assert.match(f.dom.window.document.body.textContent ?? '', /Saved in memory/);
    await act(async () => f.current.removeSavedSetup(id));
    assert.equal(f.current.savedSetups.length, 0);
    assert.deepEqual(f.setup, before);
    assert.equal(f.writes.length, count);
  } finally {
    await f.dispose();
  }
});
test('malformed storage stays recoverable and blocks transitions until explicitly cleared', async () => {
  const f = await mount({ stored: '{bad' });
  try {
    await f.click('Choose Veo');
    await f.tick();
    await f.respond(0);
    assert.equal(f.current.canApply, false);
    assert.match(f.dom.window.document.body.textContent ?? '', /cannot be read/);
    await f.click('Remove unreadable configurations');
    assert.equal(f.current.canApply, true);
    await f.click('Apply model');
    assert.equal(f.setup.form.engineId, 'veo-3-1');
  } finally {
    await f.dispose();
  }
});

test('ready mixed originals survive a route remount and saved recovery; incomplete/oversized sources never apply', async () => {
  let savedRecord: string | null = null;
  const f = await mount();
  try {
    const ref = (fieldId: string, kind: 'image' | 'video' | 'audio') => ({
      id: kind,
      assetId: `original-${kind}`,
      fieldId,
      kind,
      name: kind,
      type: `${kind}/test`,
      size: 1,
      status: 'ready' as const,
      url: `https://example.com/${kind}`,
      previewUrl: `blob:${kind}`,
      durationSec: 4,
    });
    await f.edit({
      inputAssets: {
        image_urls: [ref('image_urls', 'image')],
        video_urls: [ref('video_urls', 'video')],
        audio_urls: [ref('audio_urls', 'audio')],
      },
    });
    await f.click('Choose Veo');
    await f.tick();
    if (f.requests.length) await f.respond(0);
    await act(async () => f.current.apply());
    assert.equal(f.setup.form.engineId, 'veo-3-1');
    savedRecord = f.storage.getItem(workspaceModelSetupsKey('a'));
    const count = f.writes.length;
    await f.edit({ prompt: 'x'.repeat(1_048_576) });
    await f.click('Choose Kling');
    await act(async () => f.current.apply());
    assert.equal(f.writes.length, count);
  } finally {
    await f.dispose();
  }
  const restored = await mount({ stored: savedRecord });
  try {
    assert.equal(restored.current.savedSetups.length, 1);
    const saved = restored.current.savedSetups[0].saved!;
    assert.equal(saved.setup.inputAssets.image_urls[0]!.assetId, 'original-image');
    assert.equal(saved.setup.inputAssets.video_urls[0]!.url, 'https://example.com/video');
    assert.equal(saved.setup.inputAssets.audio_urls[0]!.previewUrl, 'https://example.com/audio');
    await act(async () => restored.current.selectSavedSetup(saved.modelId));
    assert.equal(restored.current.candidate?.keptReferences.length, 3);
    assert.equal(restored.current.candidate?.comparable, false);
    await restored.click('Cancel');
    await restored.edit({
      inputAssets: {
        image_url: [
          {
            id: 'pending',
            fieldId: 'image_url',
            kind: 'image',
            name: 'pending',
            type: 'image/png',
            size: 1,
            previewUrl: 'blob:pending',
            status: 'uploading',
          },
        ],
      },
    });
    await restored.click('Choose Veo');
    assert.equal(restored.current.canApply, false);
    await act(async () => restored.current.apply());
    assert.equal(restored.writes.length, 0);
  } finally {
    await restored.dispose();
  }
});
test('a failed candidate quote exposes Retry and FR missing input permits only explicit configuration application', async () => {
  const f = await mount();
  try {
    await f.click('Choose Veo');
    await f.tick();
    await act(async () => f.requests[0].reject(new Error('Network down')));
    assert.equal(f.current.canApply, false);
    assert.match(f.dom.window.document.body.textContent ?? '', /Price unavailable/);
    await f.click('Retry');
    assert.equal(f.current.quote.price, null);
    await f.tick();
    await f.respond(1);
    assert.equal(f.current.canApply, true);
  } finally {
    await f.dispose();
  }
  const fr = await mount({ locale: 'fr' });
  try {
    await fr.edit({ form: { ...fr.setup.form, mode: 'retake' } });
    await act(async () => fr.current.requestModel('ltx-2-3'));
    assert.equal(fr.current.configurationOnly, true);
    assert.equal(fr.current.quote.price, null);
    assert.equal(fr.current.canApply, true);
    assert.match(fr.dom.window.document.body.textContent ?? '', /Appliquer la configuration/);
    await fr.click('Appliquer la configuration');
    assert.equal(fr.setup.form.engineId, 'ltx-2-3');
    assert.equal(fr.requests.length, 0);
  } finally {
    await fr.dispose();
  }
});

test('unavailable and incomplete saved records remain visible and removable without touching the draft', async () => {
  const source = await mount();
  let setup!: WorkspaceModelSetup;
  try {
    setup = structuredClone(source.setup);
  } finally {
    await source.dispose();
  }
  const stored = JSON.stringify({
    version: 1,
    accountId: 'a',
    entries: {
      retired: {
        modelId: 'retired',
        updatedAt: 123,
        setup: { ...setup, form: { ...setup.form, engineId: 'retired' } },
      },
      broken: { modelId: 'broken', updatedAt: 123, setup: { prompt: 'Incomplete' } },
    },
  });
  const f = await mount({ stored });
  try {
    await f.click('Configurations · 2');
    assert.match(f.dom.window.document.body.textContent ?? '', /Model unavailable/);
    assert.match(f.dom.window.document.body.textContent ?? '', /cannot be read/);
    const before = structuredClone(f.setup);
    await f.click('Remove retired');
    await f.click('Remove broken');
    assert.deepEqual(f.setup, before);
    assert.equal(f.writes.length, 0);
    assert.equal(f.current.savedSetups.length, 0);
  } finally {
    await f.dispose();
  }
});

test('logged-out exploration uses the existing callback without private snapshots; pending choices explain their state', async () => {
  const f = await mount();
  try {
    await f.auth(null);
    await f.click('Choose Veo');
    assert.equal(f.setup.form.engineId, 'veo-3-1');
    assert.equal(f.current.panel, null);
    assert.equal(f.storage.length, 0);
    assert.equal(f.current.savedSetups.length, 0);
    await f.click('Compare');
    assert.equal(f.authRequests, 1);
    assert.equal(f.current.panel, null);
    assert.equal(f.requests.length, 0);
    const staleGuest = f.current.requestModel;
    await f.pending();
    assert.match(f.dom.window.document.body.textContent ?? '', /Checking account/);
    assert.ok(f.current.selectorDisabledReasons?.['kling-3-pro']);
    await f.click('Choose Kling');
    await act(async () => staleGuest('kling-3-pro'));
    assert.equal(f.setup.form.engineId, 'veo-3-1');
    assert.equal(f.storage.length, 0);
  } finally {
    await f.dispose();
  }
});

test('Cancel, target replacement and Retry invalidate Apply immediately within one event', async () => {
  const f = await mount();
  try {
    await f.click('Choose Veo');
    await f.tick();
    await f.respond(0);
    let stale = f.current.apply;
    await act(async () => {
      f.current.close();
      stale();
    });
    assert.equal(f.writes.length, 0);
    await f.click('Choose Veo');
    await f.tick();
    await f.respond(1);
    stale = f.current.apply;
    await act(async () => {
      f.current.requestModel('kling-3-pro');
      stale();
    });
    assert.equal(f.writes.length, 0);
    await f.tick();
    await f.respond(2);
    stale = f.current.apply;
    await act(async () => {
      f.current.retry();
      stale();
    });
    assert.equal(f.writes.length, 0);
    assert.equal(f.current.quote.price, null);
  } finally {
    await f.dispose();
  }
});

test('the real full catalogue browser stays keyboard-contained and Escape returns to the review', async () => {
  const f = await mount();
  try {
    await f.click('Compare');
    const dialog = f.dom.window.document.querySelector('[aria-modal=true]')!;
    await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-haspopup=dialog]')!.click());
    const portal = f.dom.window.document.querySelector('[data-engine-select-portal]')!;
    const buttons = [
      ...portal.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',
      ),
    ].filter((e) => e.tabIndex >= 0);
    assert.ok(buttons.length > 2);
    buttons[0].focus();
    await act(async () =>
      buttons[0].dispatchEvent(
        new f.dom.window.KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    assert.equal(f.dom.window.document.activeElement, buttons[buttons.length - 1]);
    await act(async () =>
      buttons[buttons.length - 1].dispatchEvent(
        new f.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      ),
    );
    assert.ok(f.dom.window.document.querySelector('[aria-modal=true]'));
    assert.equal(dialog.querySelector('[aria-haspopup=dialog]')?.getAttribute('aria-expanded'), 'false');
    assert.equal(f.writes.length, 0);
  } finally {
    await f.dispose();
  }
});

test('a storage read failure never overwrites the unknown existing record even when writes are allowed', async () => {
  const f = await mount({ readUnavailableOnly: true, stored: 'unknown existing record' });
  try {
    await f.click('Choose Veo');
    await f.tick();
    await f.respond(0);
    await f.click('Apply model');
    assert.equal(f.current.memoryOnly, true);
    assert.equal(f.current.savedSetups.length, 1);
    assert.equal(f.storage.getItem(workspaceModelSetupsKey('a')), 'unknown existing record');
  } finally {
    await f.dispose();
  }
});

test('Apply releases only replaced temporary previews after saving durable originals; Cancel releases nothing', async () => {
  const originalRevoke = URL.revokeObjectURL;
  const revoked: string[] = [];
  URL.revokeObjectURL = (url) => {
    revoked.push(url);
  };
  const f = await mount();
  try {
    const ref = (fieldId: string, previewUrl: string) => ({
      id: fieldId,
      fieldId,
      previewUrl,
      url: `https://example.com/${fieldId}`,
      kind: 'image' as const,
      status: 'ready' as const,
      name: fieldId,
      type: 'image/png',
      size: 1,
    });
    await f.edit({
      inputAssets: {
        image_url: [ref('image_url', 'blob:kept')],
        end_image_url: [ref('end_image_url', 'blob:removed')],
      },
    });
    await f.click('Choose Veo');
    await f.click('Cancel');
    assert.deepEqual(revoked, []);
    await f.click('Choose Veo');
    await f.tick();
    await f.respond(0);
    await f.click('Apply model');
    assert.deepEqual(revoked, ['blob:removed']);
    assert.equal(f.setup.inputAssets.image_url[0]!.previewUrl, 'blob:kept');
    assert.doesNotMatch(f.storage.getItem(workspaceModelSetupsKey('a'))!, /blob:/);
  } finally {
    await f.dispose();
    URL.revokeObjectURL = originalRevoke;
  }
});
