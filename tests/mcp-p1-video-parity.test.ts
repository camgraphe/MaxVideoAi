import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { UNPUBLISHED_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/registry';
import type { EngineCaps, Mode } from '../frontend/types/engines';
import {
  listAgentModels,
  type AgentModelAccessContext,
  type AgentModelCatalogDeps,
  type AgentPublicGenerationEngine,
} from '../frontend/src/server/agent-api/model-catalog';
import { getAgentModelDetails } from '../frontend/src/server/agent-api/model-details';
import {
  GenerationCapabilityError,
  validateCanonicalGenerationCapabilities,
} from '../frontend/src/server/agent-api/generation-capability-validation';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import {
  resolveAgentGenerationModeExecutability,
  resolveAgentGenerationRequestExecutability,
  type AgentGenerationExecutabilityEnvironment,
} from '../frontend/src/server/agent-runtime/model-executability';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';
import {
  resolveMcpPrelaunchModelAccess,
} from '../frontend/src/server/mcp/provider-canary-access';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import {
  validateGenerationMediaConstraints,
  type StoredMediaMetadataRow,
} from '../frontend/app/api/generate/_lib/generation-media-constraints';
import { processAndValidateGenerationAttachments } from '../frontend/app/api/generate/_lib/generation-attachment-processing';
import { prepareGenerationInputSchema } from '../frontend/src/server/mcp/tools/prepare-generation';

const P1_PRIVATE_IDS = [
  'kling-3-turbo-standard',
  'kling-3-turbo-pro',
  'minimax-h3-max',
] as const;

const privateById = new Map(
  UNPUBLISHED_FAL_ENGINE_REGISTRY.map((entry) => [entry.id, entry.engine]),
);
const publicEntries = listFalEngines();
const access: AgentModelAccessContext = {
  allowedPrelaunchModelIds: new Set(P1_PRIVATE_IDS),
};

const executionEnvironment: AgentGenerationExecutabilityEnvironment = {
  bytePlusEnabled: false,
  bytePlusApiKey: undefined,
  falApiKey: 'fal-canary-key',
  providerEnv: {
    GOOGLE_VERTEX_OMNI_ENABLED: 'true',
    GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED: 'true',
    GOOGLE_VERTEX_OMNI_ADMIN_ONLY: 'false',
    GOOGLE_VERTEX_OMNI_PROJECT_ID: 'canary-project',
    GOOGLE_VERTEX_OMNI_SERVICE_ACCOUNT_JSON:
      '{"client_email":"canary@example.com","private_key":"key"}',
  },
};

function deps(): AgentModelCatalogDeps {
  return {
    async listEngines() {
      return publicEntries.map((entry) => entry.engine);
    },
    async getEngineIncludingHidden(engineId) {
      return privateById.get(engineId);
    },
    surfaceByEngineId(engineId) {
      return publicEntries.some((entry) => entry.id === engineId) || privateById.has(engineId)
        ? 'video'
        : null;
    },
    isEngineExecutable(engine) {
      return engine.modes.some((mode) =>
        resolveAgentGenerationModeExecutability(engine, mode, executionEnvironment).executable);
    },
    isModeExecutable(engine, mode) {
      return resolveAgentGenerationModeExecutability(engine, mode, executionEnvironment).executable;
    },
  };
}

function candidate(engineId: string, modes: readonly Mode[]): AgentPublicGenerationEngine {
  const entry = publicEntries.find((item) => item.id === engineId)
    ?? UNPUBLISHED_FAL_ENGINE_REGISTRY.find((item) => item.id === engineId);
  assert.ok(entry);
  return {
    engine: entry.engine,
    surface: 'video',
    publicModes: [...modes] as AgentPublicGenerationEngine['publicModes'],
    modeCaps: Object.fromEntries(
      entry.modes
        .filter(({ mode }) => modes.includes(mode))
        .map(({ mode, ui }) => [mode, ui]),
    ),
  };
}

function request(input: Record<string, unknown>): CanonicalGenerationRequest {
  return normalizeGenerationRequest({
    schemaVersion: 1,
    surface: 'video',
    prompt: 'Create a controlled cinematic sequence.',
    outputCount: 1,
    ...input,
  });
}

function resolved(input: Partial<ResolvedReference> & Pick<ResolvedReference, 'assetId' | 'role' | 'mediaKind' | 'storageUrl'>): ResolvedReference {
  return {
    width: input.mediaKind === 'image' ? 1280 : null,
    height: input.mediaKind === 'image' ? 720 : null,
    durationSec: input.mediaKind === 'video' ? 8 : null,
    mimeType: input.mediaKind === 'image' ? 'image/png' : 'video/mp4',
    sizeBytes: 1_024,
    originalName: input.mediaKind === 'image' ? 'frame.png' : 'source.mp4',
    ...input,
  };
}

test('P1 private identities stay out of public discovery and require exact launch-canary access', async () => {
  const catalogDeps = deps();
  const publicIds = new Set((await listAgentModels({}, catalogDeps)).map(({ id }) => id));
  for (const id of P1_PRIVATE_IDS) assert.equal(publicIds.has(id), false, id);

  for (const id of P1_PRIVATE_IDS) {
    assert.deepEqual(await listAgentModels({ id }, catalogDeps), [], id);
    const details = await getAgentModelDetails(id, catalogDeps, access);
    assert.equal(details.id, id);
    assert.equal(details.prelaunch, true);
    assert.equal(details.links.model, null);
  }

  const principal: AgentPrincipal = {
    userId: 'p1-canary-account', clientId: 'p1-canary-client', emailVerified: true, authMethod: 'oauth',
  };
  const canary = resolveMcpPrelaunchModelAccess(principal, 'https://maxvideoai-mcp-staging.vercel.app/account', {
    NODE_ENV: 'production',
    MCP_STAGING_OPERATIONAL_ENABLED: 'true',
    MCP_STAGING_CANARY_ACCOUNT_IDS: principal.userId,
    MCP_STAGING_CANARY_CLIENT_IDS: principal.clientId!,
  } as NodeJS.ProcessEnv);
  assert.deepEqual([...canary!.allowedModelIds].sort(), [...P1_PRIVATE_IDS].sort());
  assert.equal(resolveMcpPrelaunchModelAccess(
    principal,
    'https://maxvideoai.com/account',
    { NODE_ENV: 'production' } as NodeJS.ProcessEnv,
  ), null);
});

test('P1 details expose only the actually executable canary modes and shared capability facts', async () => {
  const catalogDeps = deps();
  const gemini = await getAgentModelDetails('gemini-omni-flash', catalogDeps);
  assert.equal(gemini.label, 'Gemini Omni Flash 1.1');
  assert.deepEqual(gemini.modes.map(({ mode }) => mode), [
    't2v', 'i2v', 'ref2v', 'fl2v', 'v2v', 'extend',
  ]);
  assert.equal(gemini.modes.some(({ mode }) => mode === 'retake'), false);
  assert.deepEqual(gemini.modes.find(({ mode }) => mode === 'fl2v')?.duration.options, [3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(gemini.modes.find(({ mode }) => mode === 'fl2v')?.resolutions, ['360p', '720p', '1080p', '4k']);
  assert.deepEqual(gemini.modes.find(({ mode }) => mode === 'fl2v')?.aspectRatios, ['16:9', '9:16']);
  assert.equal(gemini.modes.find(({ mode }) => mode === 'fl2v')?.references.every(({ assetRequired }) => assetRequired), true);
  assert.equal(gemini.modes.find(({ mode }) => mode === 'extend')?.references[0]?.assetRequired, true);

  for (const id of ['kling-3-turbo-standard', 'kling-3-turbo-pro'] as const) {
    const details = await getAgentModelDetails(id, catalogDeps, access);
    assert.deepEqual(details.modes.map(({ mode }) => mode), ['t2v', 'i2v']);
    assert.deepEqual(details.modes[0]?.duration.options, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    assert.ok(details.modes[0]?.settings.some(({ key, type }) => key === 'multiPrompt' && type === 'multi_prompt'));
    const serialized = JSON.stringify(details).toLowerCase();
    assert.equal(serialized.includes('fal-ai/'), false);
    assert.equal(serialized.includes('"provider":"fal"'), false);
    assert.equal(serialized.includes('fallback'), false);
    assert.equal(serialized.includes('kling'), true);
  }

  const h3 = await getAgentModelDetails('minimax-h3-max', catalogDeps, access);
  assert.deepEqual(h3.modes.map(({ mode }) => mode), ['t2v']);
  const h3Serialized = JSON.stringify(h3).toLowerCase();
  assert.equal(h3Serialized.includes('fal-ai/'), false);
  assert.equal(h3Serialized.includes('"provider":"fal"'), false);
  assert.equal(h3Serialized.includes('fal-ai'), false);
  assert.equal(h3Serialized.includes('minimax/h3-max'), false);
});

test('Gemini first/last-frame and extension require owned media with trusted metadata end to end', () => {
  const gemini = candidate('gemini-omni-flash', ['fl2v', 'extend']);
  const firstId = 'ma_11111111111111111111111111111111';
  const lastId = 'ma_22222222222222222222222222222222';
  const videoId = 'ma_33333333333333333333333333333333';
  const fl2v = request({
    engineId: 'gemini-omni-flash', mode: 'fl2v',
    settings: { durationSec: 6, resolution: '720p', aspectRatio: '16:9' },
    references: [
      { kind: 'asset', assetId: firstId, role: 'first_frame' },
      { kind: 'asset', assetId: lastId, role: 'last_frame' },
    ],
  });
  const fl2vResolved = [
    resolved({ assetId: firstId, role: 'first_frame', mediaKind: 'image', storageUrl: 'https://cdn.example.com/first.png' }),
    resolved({ assetId: lastId, role: 'last_frame', mediaKind: 'image', storageUrl: 'https://cdn.example.com/last.png' }),
  ];
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(fl2v, gemini, { resolvedReferences: fl2vResolved }));
  assert.throws(() => validateCanonicalGenerationCapabilities(request({
    engineId: 'gemini-omni-flash', mode: 'fl2v',
    settings: { durationSec: 6, resolution: '720p', aspectRatio: '16:9' },
    references: [
      { kind: 'https', url: 'https://cdn.example.com/first.png', role: 'first_frame', mediaKind: 'image' },
      { kind: 'https', url: 'https://cdn.example.com/last.png', role: 'last_frame', mediaKind: 'image' },
    ],
  }), gemini), (error) => error instanceof GenerationCapabilityError && error.kind === 'reference_invalid');
  const fl2vBody = buildPaidVideoRequestBody({
    quoteId: 'quote-p1-fl2v', request: fl2v, resolvedReferences: fl2vResolved,
    engine: gemini.engine, canonicalPricing: { membershipTier: 'member' },
  });
  assert.equal(fl2vBody.imageUrl, 'https://cdn.example.com/first.png');
  assert.equal(fl2vBody.endImageUrl, 'https://cdn.example.com/last.png');

  const extend = request({
    engineId: 'gemini-omni-flash', mode: 'extend',
    settings: { durationSec: 6, resolution: '720p', aspectRatio: '16:9' },
    references: [{ kind: 'asset', assetId: videoId, role: 'source' }],
  });
  const extendResolved = [resolved({
    assetId: videoId, role: 'source', slot: 0, mediaKind: 'video',
    storageUrl: 'https://cdn.example.com/source.mp4', durationSec: 8,
  })];
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(extend, gemini, { resolvedReferences: extendResolved }));
  const extendBody = buildPaidVideoRequestBody({
    quoteId: 'quote-p1-extend', request: extend, resolvedReferences: extendResolved,
    engine: gemini.engine, canonicalPricing: { membershipTier: 'member' },
  });
  assert.equal(extendBody.videoUrl, 'https://cdn.example.com/source.mp4');
});

test('the website route enforces Gemini owned-media provenance and trusted file metadata', async () => {
  const engine = publicEntries.find((entry) => entry.id === 'gemini-omni-flash')?.engine;
  assert.ok(engine?.inputSchema);
  const firstUrl = 'https://media.maxvideoai.com/user-assets/first.png';
  const lastUrl = 'https://media.maxvideoai.com/user-assets/last.png';
  const direct = await processAndValidateGenerationAttachments({
    engineId: engine.id,
    mode: 'fl2v',
    userId: 'p1-media-user',
    inputSchema: engine.inputSchema,
    rawInputs: [{
      name: 'first.png', type: 'image/png', size: 1_024, kind: 'image',
      slotId: 'image_url', url: firstUrl,
    }],
  });
  assert.equal(direct.ok, false);
  if (!direct.ok) assert.equal(direct.body.error, 'OWNED_MEDIA_REQUIRED');

  const attachments = [
    {
      name: 'first.png', type: 'image/png', size: 1_024, kind: 'image' as const,
      slotId: 'image_url', url: firstUrl, assetId: 'asset-first',
    },
    {
      name: 'last.png', type: 'image/png', size: 2_048, kind: 'image' as const,
      slotId: 'end_image_url', url: lastUrl, assetId: 'asset-last',
    },
  ];
  const referenceMediaItems = [
    { fieldId: 'image_url', kind: 'image' as const, url: firstUrl },
    { fieldId: 'end_image_url', kind: 'image' as const, url: lastUrl },
  ];
  const storedRows: StoredMediaMetadataRow[] = [
    {
      asset_id: 'asset-first', url: firstUrl, origin_url: null, original_name: 'first.png',
      mime_type: 'image/png', size_bytes: 1_024, width: 1280, height: 720,
    },
    {
      asset_id: 'asset-last', url: lastUrl, origin_url: null, original_name: 'last.png',
      mime_type: 'image/png', size_bytes: 2_048, width: 1280, height: 720,
    },
  ];
  const validated = await validateGenerationMediaConstraints({
    engineId: engine.id,
    mode: 'fl2v',
    userId: 'p1-media-user',
    inputSchema: engine.inputSchema,
    attachments,
    referenceMediaItems,
    deps: { queryFn: async <T>() => storedRows as T[] },
  });
  assert.deepEqual(validated, { ok: true });

  const missingTrustedSize = await validateGenerationMediaConstraints({
    engineId: engine.id,
    mode: 'fl2v',
    userId: 'p1-media-user',
    inputSchema: engine.inputSchema,
    attachments,
    referenceMediaItems,
    deps: {
      queryFn: async <T>() => storedRows.map((row, index) =>
        index === 0 ? { ...row, size_bytes: null } : row) as T[],
    },
  });
  assert.equal(missingTrustedSize.ok, false);
  if (!missingTrustedSize.ok) assert.equal(missingTrustedSize.body.error, 'MEDIA_METADATA_UNVERIFIED');
});

test('Kling Turbo multi-shot is canonical, validated, and projected into the paid site request', () => {
  const kling = candidate('kling-3-turbo-standard', ['t2v']);
  const multiPrompt = [
    { prompt: 'Wide establishing shot.', durationSec: 3 },
    { prompt: 'Close product reveal.', durationSec: 4 },
  ];
  const canonical = request({
    engineId: 'kling-3-turbo-standard', mode: 't2v', prompt: '',
    settings: {
      durationSec: 7, resolution: '720p', aspectRatio: '16:9', multiPrompt,
    },
    references: [],
  });
  assert.equal(prepareGenerationInputSchema.safeParse(canonical).success, true);
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(canonical, kling));
  const body = buildPaidVideoRequestBody({
    quoteId: 'quote-p1-kling', request: canonical, engine: kling.engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.deepEqual(body.multiPrompt, [
    { prompt: 'Wide establishing shot.', duration: 3 },
    { prompt: 'Close product reveal.', duration: 4 },
  ]);
  assert.equal(body.prompt, '');

  assert.throws(() => validateCanonicalGenerationCapabilities(request({
    engineId: 'kling-3-turbo-standard', mode: 't2v',
    settings: { durationSec: 7, resolution: '720p', aspectRatio: '16:9', multiPrompt },
    references: [],
  }), kling), GenerationCapabilityError);
});

test('H3 Max advertises and executes t2v only while media modes remain fail closed', () => {
  const engine = privateById.get('minimax-h3-max');
  assert.ok(engine);
  assert.equal(resolveAgentGenerationModeExecutability(engine, 't2v', executionEnvironment).executable, true);
  for (const mode of ['i2v', 'ref2v'] as const) {
    const assetId = mode === 'i2v'
      ? 'ma_44444444444444444444444444444444'
      : 'ma_55555555555555555555555555555555';
    assert.deepEqual(
      resolveAgentGenerationModeExecutability(engine, mode, executionEnvironment),
      { executable: false, reason: 'profile_invalid' },
    );
    const mediaRequest = request({
      engineId: engine.id, mode,
      settings: { durationSec: 5, resolution: '768P', ...(mode === 'ref2v' ? { aspectRatio: '16:9' } : {}) },
      references: [{
        kind: 'asset',
        assetId,
        role: mode === 'i2v' ? 'source' : 'reference',
      }],
    });
    const resolvedReferences = [resolved({
      assetId,
      role: mode === 'i2v' ? 'source' : 'reference',
      mediaKind: 'image',
      storageUrl: `https://cdn.example.com/h3-${mode}.png`,
    })];
    assert.deepEqual(
      resolveAgentGenerationRequestExecutability(mediaRequest, engine, resolvedReferences, executionEnvironment),
      { executable: false, reason: 'profile_invalid' },
    );
  }
});
