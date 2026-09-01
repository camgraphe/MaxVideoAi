import assert from 'node:assert/strict';
import test from 'node:test';

import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

test('workspace generation ignores a second submission while session preflight is pending', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://maxvideoai-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';

  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://maxvideoai.com/app',
  });
  const globalRecord = globalThis as typeof globalThis & Record<string, unknown>;
  const installedGlobals = [
    'window',
    'self',
    'document',
    'navigator',
    'HTMLElement',
    'Node',
    'React',
    'IS_REACT_ACT_ENVIRONMENT',
    'BroadcastChannel',
  ] as const;
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const install = (key: string, value: unknown) => {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalRecord, key, { configurable: true, writable: true, value });
  };
  install('window', dom.window);
  install('self', dom.window);
  install('document', dom.window.document);
  install('navigator', dom.window.navigator);
  install('HTMLElement', dom.window.HTMLElement);
  install('Node', dom.window.Node);
  install('React', React);
  install('IS_REACT_ACT_ENVIRONMENT', true);
  install('BroadcastChannel', undefined);

  const { useWorkspaceGenerationRunner } = await import(
    '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGenerationRunner.ts'
  );
  const { supabase } = await import('../frontend/src/lib/supabaseClient.ts');
  const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
  const sessionDeferred = deferred<Awaited<ReturnType<typeof originalGetSession>>>();
  let getSessionCalls = 0;
  supabase.auth.getSession = (() => {
    getSessionCalls += 1;
    return sessionDeferred.promise;
  }) as typeof supabase.auth.getSession;

  let authModalOpenCalls = 0;
  const noOp = () => undefined;
  const options = {
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
    preflight: null,
    memberTier: 'Member' as const,
    showComposerError: noOp,
    writeScopedStorage: noOp,
    mutateLatestJobs: async () => undefined,
    inputSchemaSummary: {} as never,
    extraInputFields: [],
    inputAssets: {},
    setAuthModalOpen: () => {
      authModalOpenCalls += 1;
    },
    setPreflightError: noOp,
    setTopUpModal: noOp,
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
  } satisfies Parameters<typeof useWorkspaceGenerationRunner>[0];

  let generation: ReturnType<typeof useWorkspaceGenerationRunner> | null = null;
  function Fixture() {
    generation = useWorkspaceGenerationRunner(options);
    return null;
  }

  const container = dom.window.document.querySelector<HTMLDivElement>('#root');
  assert.ok(container);
  const root = createRoot(container);
  const submissions: Promise<void>[] = [];

  try {
    await act(async () => root.render(React.createElement(Fixture)));
    assert.ok(generation);

    await act(async () => {
      submissions.push(generation!.startRender(), generation!.startRender());
      for (let attempt = 0; attempt < 20 && getSessionCalls === 0; attempt += 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
    });

    assert.equal(getSessionCalls, 1);
    assert.equal((generation as { isSubmitting?: boolean }).isSubmitting, true);

    sessionDeferred.resolve({ data: { session: null }, error: null });
    await act(async () => {
      await Promise.all(submissions);
    });

    assert.equal(authModalOpenCalls, 1);
    assert.equal((generation as { isSubmitting?: boolean }).isSubmitting, false);
  } finally {
    sessionDeferred.resolve({ data: { session: null }, error: null });
    await Promise.allSettled(submissions);
    await act(async () => root.unmount());
    supabase.auth.getSession = originalGetSession;
    supabase.auth.stopAutoRefresh();
    await supabase.removeAllChannels();
    supabase.realtime.disconnect();
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalRecord, key, descriptor);
      else delete globalRecord[key];
    }
  }
});
