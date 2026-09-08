import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

async function mount() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://maxvideoai-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.com/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const wallet: Array<(response: Response) => void> = [];
  const generated: RequestInit[] = [];
  const walletRequests: RequestInit[] = [];
  for (const [key, value] of Object.entries({ window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined,
    fetch: (url: string, init: RequestInit) => {
      if (url === '/api/wallet') { walletRequests.push(init); return new Promise<Response>(resolve => wallet.push(resolve)); }
      assert.equal(url, '/api/generate'); generated.push(init); return new Promise<Response>(() => {});
    },
  })) { previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  const { useWorkspaceGenerationRunner } = await import('../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGenerationRunner');
  const { supabase } = await import('../frontend/src/lib/supabaseClient');
  const original = supabase.auth.getSession;
  const sessions: Array<(value: Awaited<ReturnType<typeof original>>) => void> = [];
  supabase.auth.getSession = () => new Promise(resolve => sessions.push(resolve));
  const noOp = () => undefined;
  let authModalOpenCalls = 0;
  const errors: string[] = [];
  const topups: unknown[] = [];
  let options = {
    audioWorkflowUnsupported: false,
    klingO3UnsupportedVideoReason: null,
    form: {
      engineId: 'test-video',
      mode: 't2v' as const,
      durationSec: 5,
      resolution: '720p',
      aspectRatio: '16:9',
      fps: 24,
      iterations: 1,
      audio: false,
      extraInputValues: {},
    },
    activeMode: 't2v' as const,
    submissionMode: 't2v' as const,
    effectivePrompt: 'A cinematic test prompt',
    effectiveDurationSec: 5,
    negativePrompt: '',
    selectedEngine: {
      id: 'test-video',
      label: 'Test Video',
    } as never,
    preflight: { ok: true, total: 125 },
    accessToken: 'fixture-a',
    authChecked: true,
    memberTier: 'Member' as const,
    showComposerError: (message: string) => { errors.push(message); },
    writeScopedStorage: noOp,
    mutateLatestJobs: async () => undefined,
    inputSchemaSummary: { assetFields: [], promptRequired: true } as never,
    extraInputFields: [],
    inputAssets: {},
    setAuthModalOpen: () => {
      authModalOpenCalls += 1;
    },
    setPreflightError: noOp,
    setTopUpModal: (modal: unknown) => { topups.push(modal); },
    setActiveGroupId: noOp,
    setActiveBatchId: noOp,
    setBatchHeroes: noOp,
    setRenders: noOp,
    setSelectedPreview: noOp,
    setViewMode: noOp,
    rendersRef: { current: [] },
    uiLocale: 'en',
    workflowCopy: {
      audioUnsupported: 'Audio unsupported',
      addReferenceMediaBeforeAudio: 'Add reference media',
      addSourceVideo: (modeLabel: string) => `Add source video for ${modeLabel}`,
    },
    workspaceCopy: {
      wallet: {
        insufficient: 'Insufficient funds',
        insufficientWithAmount: 'Insufficient funds by {amount}',
      },
    } as never,
    capability: undefined,
    cfgScale: null,
    formatTakeLabel: (current: number, total: number) => `${current}/${total}`,
    primaryAssetFieldLabel: 'Image',
    primaryAssetFieldIds: new Set<string>(),
    referenceAssetFieldIds: new Set<string>(),
    referenceAudioFieldIds: new Set<string>(),
    genericImageFieldIds: new Set<string>(),
    frameAssetFieldIds: new Set<string>(),
    allowsUnifiedVeoFirstLast: false,
    hasLastFrameInput: false,
    supportsAudioToggle: false,
    multiPromptActive: false,
    multiPromptInvalid: false,
    multiPromptError: null,
    multiPromptScenes: [],
    supportsKlingV3Controls: false,
    supportsKlingV3VoiceControl: false,
    isSeedance: false,
    isUnifiedSeedance: false,
    promptLength: 23,
    promptCharLimitExceeded: false,
    promptMaxChars: null,
    voiceIds: [],
    voiceControlEnabled: false,
    shotType: 'customize' as const,
    klingElements: [],
  } as Parameters<typeof useWorkspaceGenerationRunner>[0];

  let generation!: ReturnType<typeof useWorkspaceGenerationRunner>;
  function Fixture() { generation = useWorkspaceGenerationRunner(options); return null; }
  const root = createRoot(dom.window.document.getElementById('root')!);
  let mounted = true;
  let submission: Promise<void> | undefined;
  await act(async () => root.render(React.createElement(Fixture)));
  return {
    wallet, walletRequests, generated, errors, topups,
    sessionHint() { dom.window.sessionStorage.setItem('last-known:user-id', 'fixture-user'); },
    get pendingSessions() { return sessions.length; },
    get options() { return options; },
    async start() { await act(async () => { submission = generation.startRender(); for (let i = 0; i < 20 && !sessions.length; i++) await new Promise(resolve => setTimeout(resolve, 5)); }); },
    async session(token: string | null = 'fixture-a') { await act(async () => { sessions.shift()!({ data: { session: token ? { access_token: token } as never : null }, error: null }); await new Promise(resolve => setTimeout(resolve, 0)); }); },
    async balance(balanceCents = 100000) { await act(async () => { wallet[0](new Response(JSON.stringify({ balanceCents }))); await submission; }); },
    async update(patch: Partial<typeof options>) { options = { ...options, ...patch }; await act(async () => root.render(React.createElement(Fixture))); },
    async unmount() { await act(async () => root.unmount()); mounted = false; },
    async dispose() { if (mounted) await act(async () => root.unmount()); supabase.auth.getSession = original; dom.window.close(); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } },
  };
}

test('draft change during deferred session rejects captured quote before wallet fetch', async () => {
  const f = await mount();
  try {
    await f.start(); await f.update({ preflight: null, form: { ...f.options.form!, durationSec: 10 } });
    await f.session('fixture-b'); assert.equal(f.wallet.length, 0); assert.equal(f.generated.length, 0);
  } finally { await f.dispose(); }
});

for (const boundary of ['session', 'wallet'] as const) {
  for (const change of ['draft', 'account', 'iterations', 'auth', 'quote', 'prompt', 'unmount'] as const) {
    test(`${change} change during ${boundary} wait cancels submission`, async () => {
      const f = await mount();
      try {
        await f.start();
        if (boundary === 'wallet') { await f.session(); assert.equal(f.wallet.length, 1); }
        if (change === 'draft') await f.update({ form: { ...f.options.form!, durationSec: 10 } });
        if (change === 'account') await f.update({ accessToken: 'fixture-b' });
        if (change === 'iterations') await f.update({ form: { ...f.options.form!, iterations: 3 } });
        if (change === 'auth') await f.update({ authChecked: false });
        if (change === 'quote') await f.update({ preflight: null });
        if (change === 'prompt') await f.update({ effectivePrompt: 'A changed prompt' });
        if (change === 'unmount') await f.unmount();
        if (boundary === 'session') { await f.session(); assert.equal(f.wallet.length, 0); }
        else await f.balance(0);
        assert.equal(f.generated.length, 0);
        assert.deepEqual(f.errors, []); assert.deepEqual(f.topups, []);
      } finally { await f.dispose(); }
    });
  }
}

test('mismatched session token cannot use an otherwise current quote', async () => {
  const f = await mount();
  try { await f.start(); await f.session('fixture-b'); assert.equal(f.wallet.length, 0); assert.equal(f.generated.length, 0); }
  finally { await f.dispose(); }
});

for (const total of [125, 0]) {
  test(`matching submission with a ${total}-cent quote reaches generation`, async () => {
    const f = await mount();
    try {
      await f.update({ preflight: { ok: true, total } });
      await f.start(); await f.session();
      if (total) { assert.equal(f.wallet.length, 1); await f.balance(); }
      else assert.equal(f.wallet.length, 0);
      assert.equal(f.generated.length, 1);
      const payload = JSON.parse(f.generated[0].body as string);
      assert.equal(payload.durationSec, 5);
      assert.equal(new Headers(f.generated[0].headers).get('Authorization'), 'Bearer fixture-a');
    } finally { await f.dispose(); }
  });
}

test('returning to the original draft does not revive an in-flight attempt', async () => {
  const f = await mount();
  try {
    const form = f.options.form;
    await f.start(); await f.update({ form: { ...form!, iterations: 3 } }); await f.update({ form });
    await f.session(); assert.equal(f.wallet.length, 0); assert.equal(f.generated.length, 0);
  } finally { await f.dispose(); }
});


test('explicit workspace token dispatches wallet and generation without an intervening session await', async () => {
  const f = await mount();
  try {
    f.sessionHint(); await f.start(); await f.session();
    assert.equal(f.pendingSessions, 0); assert.equal(f.wallet.length, 1);
    await f.balance(); assert.equal(f.pendingSessions, 0); assert.equal(f.generated.length, 1);
  } finally { await f.dispose(); }
});


test('implicit authFetch callers still resolve session and attach its token', async () => {
  const f = await mount();
  try {
    f.sessionHint();
    const { authFetch } = await import('../frontend/src/lib/authFetch');
    let response!: Promise<Response>;
    await act(async () => { response = authFetch('/api/wallet'); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(f.pendingSessions, 1); assert.equal(f.wallet.length, 0);
    await f.session(); assert.equal(f.wallet.length, 1);
    assert.equal(new Headers(f.walletRequests[0].headers).get('Authorization'), 'Bearer fixture-a');
    await f.balance(); await response;
  } finally { await f.dispose(); }
});
