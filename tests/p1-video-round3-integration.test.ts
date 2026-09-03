import assert from 'node:assert/strict';
import test from 'node:test';

import { JSDOM } from 'jsdom';
import { NextRequest } from 'next/server';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';

import { createEnginesGetHandler } from '../frontend/app/api/engines/_lib/engines-get-handler';
import { createPreflightPostHandler } from '../frontend/app/api/preflight/_lib/preflight-handler';
import { resolveGenerateRouteContext } from '../frontend/app/api/generate/_lib/route-context';
import { useWorkspacePricingGate } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { buildWorkspaceGeneratePayload } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-payload';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import { DEFAULT_WORKSPACE_COPY } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-copy';
import { useEngines } from '../frontend/lib/api-engines';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { KLING_3_TURBO_PRO_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-pro';
import { KLING_3_TURBO_STANDARD_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-standard';
import type { AgentGenerationExecutabilityEnvironment } from '../frontend/src/server/agent-runtime/model-executability';
import type { EngineCaps, EnginesResponse, PreflightRequest } from '../frontend/types/engines';

const CANARY_USER_ID = '00000000-0000-4000-8000-000000000701';
const CANARY_TOKEN = 'round3-canary-session-token';
const STAGING_URL = 'https://maxvideoai-mcp-staging.vercel.app';

type BrowserGlobals = 'window' | 'self' | 'document' | 'navigator' | 'HTMLElement' | 'Node'
  | 'React' | 'IS_REACT_ACT_ENVIRONMENT' | 'BroadcastChannel';

async function withBrowser<T>(callback: (dom: JSDOM) => Promise<T>): Promise<T> {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: `${STAGING_URL}/app`,
  });
  const globalRecord = globalThis as typeof globalThis & Record<string, unknown>;
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const install = (key: BrowserGlobals, value: unknown) => {
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
  try {
    return await callback(dom);
  } finally {
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalRecord, key, descriptor);
      else delete globalRecord[key];
    }
  }
}

async function waitFor(predicate: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (predicate()) return;
    await act(async () => new Promise<void>((resolve) => setTimeout(resolve, 10)));
  }
  assert.fail(message);
}

test('engine SWR data stays principal-scoped across canary, logout, login, and account switches', { concurrency: false }, async () => {
  await withBrowser(async (dom) => {
    const originalFetch = globalThis.fetch;
    const originalSetTimeout = globalThis.setTimeout;
    const mountedRoots = new Set<Root>();
    const outstandingTimers = new Set<ReturnType<typeof setTimeout>>();
    const observedAuthorizations: Array<string | null> = [];
    globalThis.setTimeout = ((handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]) => {
      let timer: ReturnType<typeof setTimeout>;
      timer = originalSetTimeout(() => {
        outstandingTimers.delete(timer);
        handler(...args);
      }, timeout);
      outstandingTimers.add(timer);
      return timer;
    }) as typeof setTimeout;
    globalThis.fetch = (async (_input, init) => {
      const authorization = new Headers(init?.headers).get('Authorization');
      observedAuthorizations.push(authorization);
      const engines = authorization === `Bearer ${CANARY_TOKEN}`
        ? [{ id: 'public-engine' }, { id: 'kling-3-turbo-standard' }]
        : [{ id: 'public-engine' }];
      return Response.json({ ok: true, engines, engineScores: {} });
    }) as typeof fetch;

    type AuthScope =
      | { status: 'authenticated'; principalId: string; accessToken: string }
      | { status: 'anonymous' };
    const renderWithCache = async (cache: Map<unknown, unknown>, initialScope: AuthScope) => {
      const container = dom.window.document.createElement('div');
      dom.window.document.body.append(container);
      const root = createRoot(container);
      mountedRoots.add(root);
      let ids: string[] | null = null;
      function Fixture({ authScope }: { authScope: AuthScope }) {
        const { data } = useEngines('video', { authScope });
        ids = data?.engines.map(({ id }) => id) ?? null;
        return null;
      }
      const renderScope = async (authScope: AuthScope) => {
        await act(async () => root.render(React.createElement(
          SWRConfig,
          { value: { provider: () => cache as Map<string, EnginesResponse> } },
          React.createElement(Fixture, { authScope }),
        )));
      };
      await renderScope(initialScope);
      return { root, readIds: () => ids, renderScope };
    };

    const unmount = async (root: Root) => {
      await act(async () => root.unmount());
      mountedRoots.delete(root);
    };

    try {
      const canaryScope = {
        status: 'authenticated' as const,
        principalId: CANARY_USER_ID,
        accessToken: CANARY_TOKEN,
      };
      const otherScope = {
        status: 'authenticated' as const,
        principalId: '00000000-0000-4000-8000-000000000702',
        accessToken: 'round3-other-session-token',
      };
      const anonymousScope = { status: 'anonymous' as const };
      const canaryFirstCache = new Map<unknown, unknown>();
      const canaryFirst = await renderWithCache(canaryFirstCache, canaryScope);
      await waitFor(
        () => canaryFirst.readIds()?.includes('kling-3-turbo-standard') === true,
        'canary engine bootstrap did not resolve',
      );
      await canaryFirst.renderScope(anonymousScope);
      await waitFor(
        () => JSON.stringify(canaryFirst.readIds()) === JSON.stringify(['public-engine']),
        'logged-out bootstrap reused the canary engine cache',
      );
      await unmount(canaryFirst.root);

      const publicFirstCache = new Map<unknown, unknown>();
      const publicFirst = await renderWithCache(publicFirstCache, anonymousScope);
      await waitFor(
        () => JSON.stringify(publicFirst.readIds()) === JSON.stringify(['public-engine']),
        'public engine bootstrap did not resolve',
      );
      await publicFirst.renderScope(canaryScope);
      await waitFor(
        () => publicFirst.readIds()?.includes('kling-3-turbo-standard') === true,
        'canary bootstrap reused the logged-out engine cache',
      );
      await publicFirst.renderScope(otherScope);
      await waitFor(
        () => JSON.stringify(publicFirst.readIds()) === JSON.stringify(['public-engine']),
        'account switch reused another principal\'s canary engine data',
      );
      assert.ok(observedAuthorizations.includes(`Bearer ${CANARY_TOKEN}`));
      assert.ok(observedAuthorizations.includes(null));
      assert.doesNotMatch(JSON.stringify([...publicFirstCache.keys()]), /round3-canary-session-token/u);
      await unmount(publicFirst.root);
    } finally {
      for (const root of mountedRoots) {
        await act(async () => root.unmount());
      }
      mountedRoots.clear();
      globalThis.fetch = originalFetch;
      globalThis.setTimeout = originalSetTimeout;
      for (const timer of outstandingTimers) globalThis.clearTimeout(timer);
      outstandingTimers.clear();
    }
  });
});

test('engine responses are no-store and vary across bearer and cookie authentication', async () => {
  const handler = createEnginesGetHandler({
    getPublicConfiguredEnginesByCategory: async () => [],
    getConfiguredEngineIncludingHidden: async () => KLING_3_TURBO_STANDARD_ENGINE,
    resolveLaunchCanaryRequestContext: async () => ({
      principal: {
        userId: CANARY_USER_ID,
        clientId: null,
        emailVerified: true,
        authMethod: 'oauth',
      },
      access: { allowedModelIds: new Set(['kling-3-turbo-standard']) },
      generationEnvironment: {
        bytePlusEnabled: false,
        bytePlusApiKey: undefined,
        falApiKey: 'test-fal-key',
        providerEnv: {},
      },
    }),
    fetchEngineAverageDurations: async () => [],
    loadAppEngineScoreMap: async () => ({}),
  });
  const response = await handler(new NextRequest(`${STAGING_URL}/api/engines`, {
    headers: { authorization: `Bearer ${CANARY_TOKEN}` },
  }));

  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(
    response.headers.get('vary')?.toLowerCase().split(',').map((value) => value.trim()).sort(),
    ['authorization', 'cookie'],
  );
});

const generationEnvironment: AgentGenerationExecutabilityEnvironment = {
  bytePlusEnabled: false,
  bytePlusApiKey: undefined,
  falApiKey: 'test-private-provider-key',
  providerEnv: {},
};

const PRIVATE_ENGINES = new Map<string, EngineCaps>([
  [KLING_3_TURBO_STANDARD_ENGINE.id, KLING_3_TURBO_STANDARD_ENGINE],
  [KLING_3_TURBO_PRO_ENGINE.id, KLING_3_TURBO_PRO_ENGINE],
]);

const privateCanaryContext = {
  principal: {
    userId: CANARY_USER_ID,
    clientId: null,
    emailVerified: true,
    authMethod: 'oauth' as const,
  },
  access: { allowedModelIds: new Set(PRIVATE_ENGINES.keys()) },
  generationEnvironment,
};

function startImage(engineId: string): ReferenceAsset {
  return {
    id: `start-${engineId}`,
    fieldId: 'image_url',
    previewUrl: `https://cdn.maxvideoai.com/${engineId}-start.png`,
    kind: 'image',
    name: 'start.png',
    size: 2_048,
    type: 'image/png',
    url: `https://cdn.maxvideoai.com/${engineId}-start.png`,
    width: 1280,
    height: 720,
    assetId: `asset-${engineId}`,
    status: 'ready',
  };
}

test('Kling Turbo i2v workspace preflight and generation omit unsupported framing settings through dispatch', { concurrency: false }, async () => {
  const preflightBodies: Array<Record<string, unknown>> = [];
  const preflightHandler = createPreflightPostHandler({
    resolveLaunchCanaryRequestContextFn: async () => privateCanaryContext,
    mediaAwarePreflightDependencies: {
      getConfiguredEngineFn: async () => undefined,
      getConfiguredEngineIncludingHiddenFn: async (engineId) => PRIVATE_ENGINES.get(engineId),
      processAttachmentsFn: async ({ attachments }) => ({
        ok: true,
        attachments,
        references: { normalizedReferenceImages: [] },
        trustedDurationSecByField: {},
      } as never),
    },
  });

  await withBrowser(async (dom) => {
    const originalFetch = globalThis.fetch;
    const mountedRoots = new Set<Root>();
    globalThis.fetch = (async (input, init) => {
      if (String(input) === '/api/member-status') {
        return Response.json({ ok: true, tier: 'Member' });
      }
      assert.equal(String(input), '/api/preflight');
      const rawBody = typeof init?.body === 'string' ? init.body : '';
      preflightBodies.push(JSON.parse(rawBody) as Record<string, unknown>);
      return preflightHandler(new NextRequest(`${STAGING_URL}/api/preflight`, {
        method: 'POST',
        headers: init?.headers,
        body: rawBody,
      }));
    }) as typeof fetch;

    try {
      for (const engine of [KLING_3_TURBO_STANDARD_ENGINE, KLING_3_TURBO_PRO_ENGINE]) {
        const form = coerceFormState(engine, 'i2v', null);
        const asset = startImage(engine.id);
        let pricingResult: ReturnType<typeof useWorkspacePricingGate> | null = null;
        function Fixture() {
          pricingResult = useWorkspacePricingGate({
            accessToken: CANARY_TOKEN,
            locale: 'en',
            topUpCopy: DEFAULT_WORKSPACE_COPY.topUp,
            form,
            selectedEngine: engine,
            authChecked: true,
            memberTier: 'Member',
            setMemberTier: () => undefined,
            supportsAudioToggle: false,
            effectiveDurationSec: form.durationSec,
            voiceControlEnabled: false,
            submissionMode: 'i2v',
            inputAssets: { image_url: [asset] },
          });
          return null;
        }
        const container = dom.window.document.createElement('div');
        dom.window.document.body.append(container);
        const root = createRoot(container);
        mountedRoots.add(root);
        await act(async () => root.render(React.createElement(Fixture)));
        await waitFor(
          () => pricingResult?.preflight?.ok === true,
          `${engine.id} workspace preflight did not reach pricing`,
        );
        await act(async () => root.unmount());
        mountedRoots.delete(root);

        const body = preflightBodies.at(-1);
        assert.ok(body);
        assert.equal(body.mode, 'i2v');
        assert.equal(body.durationSec, 5);
        assert.equal('resolution' in body, false, `${engine.id} preflight sent resolution`);
        assert.equal('aspectRatio' in body, false, `${engine.id} preflight sent aspectRatio`);
        assert.deepEqual(body.inputs, [{
          assetId: `asset-${engine.id}`,
          slotId: 'image_url',
          kind: 'image',
          url: `https://cdn.maxvideoai.com/${engine.id}-start.png`,
        }]);

        const generated = buildWorkspaceGeneratePayload({
          selectedEngineId: engine.id,
          activeMode: 'i2v',
          submissionMode: 'i2v',
          form,
          trimmedPrompt: 'Animate the verified start image.',
          trimmedNegativePrompt: '',
          effectiveDurationSec: form.durationSec,
          memberTier: 'Member',
          paymentMode: 'wallet',
          capability: engine.modeCaps?.i2v,
          inputSchema: engine.inputSchema,
          supportsNegativePrompt: false,
          supportsAudioToggle: false,
          isSeedance: false,
          supportsKlingV3Controls: false,
          supportsKlingV3VoiceControl: false,
          voiceIds: [],
          voiceControlEnabled: false,
          shotType: 'customize',
          localKey: `local-${engine.id}`,
          batchId: `batch-${engine.id}`,
          iterationIndex: 0,
          iterationCount: 1,
          friendlyMessage: 'Generating',
          lumaContext: {
            isLumaRay2GenerateWorkflow: false,
            lumaDuration: null,
            lumaResolution: null,
          },
          inputsPayload: [{
            name: asset.name,
            type: asset.type,
            size: asset.size,
            kind: asset.kind,
            slotId: 'image_url',
            url: asset.url!,
            width: asset.width,
            height: asset.height,
            assetId: asset.assetId,
          }],
          primaryImageUrl: asset.url,
          referenceImageUrls: [],
          extraInputValues: {},
        });
        assert.equal(generated.resolvedDurationSeconds, 5);
        assert.equal(generated.payload.durationOption, 5);
        assert.equal('resolution' in generated.payload, false, `${engine.id} generate sent resolution`);
        assert.equal('aspectRatio' in generated.payload, false, `${engine.id} generate sent aspectRatio`);

        const dispatched = buildFalGenerationRequest(
          generated.payload,
          engine.providerMeta?.modelSlug ?? '',
        );
        assert.equal(dispatched.requestBody.duration, '5');
        assert.equal(dispatched.requestBody.image_url, asset.url);
        assert.equal('resolution' in dispatched.requestBody, false);
        assert.equal('aspect_ratio' in dispatched.requestBody, false);
      }
    } finally {
      for (const root of mountedRoots) {
        await act(async () => root.unmount());
      }
      mountedRoots.clear();
      globalThis.fetch = originalFetch;
    }
  });
});

test('P1 and established public engines reject an explicit unknown mode before database work', async () => {
  const publicEngine = getFalEngineById('pika-text-to-video')?.engine;
  assert.ok(publicEngine);

  for (const fixture of [
    { engine: KLING_3_TURBO_STANDARD_ENGINE },
    { engine: publicEngine },
  ]) {
    let databaseChecks = 0;
    let billingChecks = 0;
    const result = await resolveGenerateRouteContext({
      req: new NextRequest(`${STAGING_URL}/api/generate`, { method: 'POST' }),
      body: { engineId: fixture.engine.id, mode: 'bogus' },
      boundaryOverrides: {
        resolveLaunchCanaryRequestContext: async () => null,
        getConfiguredEngine: async () => fixture.engine,
        getConfiguredEngineIncludingHidden: async () => undefined,
        isDatabaseConfigured: () => {
          databaseChecks += 1;
          return true;
        },
        ensureBillingSchema: async () => {
          billingChecks += 1;
        },
      },
    });

    assert.deepEqual(result, {
      ok: false,
      status: 400,
      body: { ok: false, error: 'Invalid mode' },
    });
    assert.equal(databaseChecks, 0);
    assert.equal(billingChecks, 0);
  }
});

test('preflight rejects unknown modes before pricing while generate keeps omitted public-mode compatibility', async () => {
  let pricingCalls = 0;
  const preflight = createPreflightPostHandler({
    resolveMediaAwarePreflightFn: async () => {
      pricingCalls += 1;
      return { ok: true };
    },
  });
  const preflightResponse = await preflight(new NextRequest(`${STAGING_URL}/api/preflight`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      engine: 'kling-3-turbo-standard',
      mode: 'bogus',
      durationSec: 5,
      resolution: '720p',
      fps: 24,
    }),
  }));
  assert.equal(preflightResponse.status, 400);
  assert.equal(pricingCalls, 0);

  const publicEngine = getFalEngineById('pika-text-to-video')?.engine;
  assert.ok(publicEngine);
  const generate = await resolveGenerateRouteContext({
    req: new NextRequest('https://maxvideoai.com/api/generate', { method: 'POST' }),
    body: { engineId: publicEngine.id },
    boundaryOverrides: {
      getConfiguredEngine: async () => publicEngine,
      isDatabaseConfigured: () => true,
      ensureBillingSchema: async () => undefined,
    },
  });
  assert.equal(generate.ok, true);
  if (generate.ok) assert.equal(generate.context.mode, 't2v');
});
