import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { projectAgentModelModeDetails } from '../frontend/src/server/agent-api/model-details';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { canonicalSettingsSchema } from '../frontend/src/server/mcp/tools/prepare-generation';
import { isStudioConversationVideoModeCertified } from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/models/workspace-model-certification';
import { studioVisualCapabilityDetails } from '../frontend/src/server/studio/conversation-capabilities';

const entry = getFalEngineById('flux-3-max')!;
const candidate = { engine: entry.engine, surface: 'video' as const,
  publicModes: entry.modes.map(({ mode }) => mode), modeCaps: Object.fromEntries(entry.modes.map(({ mode, ui }) => [mode, ui])) };
const input = { surface: 'video', engineId: entry.id, mode: 'ref2v', prompt: 'A continuous movement.',
  settings: { durationSec: 5, resolution: '1080p', aspectRatio: '2:1', audio: false, reasoningLevel: 'low', seed: 12, keyframeIndexes: '120,0' },
  references: ['https://media.example/z.png', 'https://media.example/a.png'].map((url) => ({ kind: 'https', url, role: 'reference', mediaKind: 'image' })) };

test('MCP and Studio expose all FLUX 3 Max controls and executable modes', () => {
  assert.equal(canonicalSettingsSchema.safeParse(input.settings).success, true);
  const details = projectAgentModelModeDetails(candidate, 'ref2v');
  assert.ok(details.settings.some((setting) => setting.key === 'reasoningLevel'));
  assert.ok(details.settings.some((setting) => setting.key === 'keyframeIndexes'));
  for (const mode of ['t2v', 'i2v', 'fl2v', 'ref2v']) assert.equal(isStudioConversationVideoModeCertified(entry.id, mode), true);
  assert.equal(isStudioConversationVideoModeCertified(entry.id, 'extend'), false);
});

test('MCP preserves authored keyframe pairing through normalization, validation and dispatch body', () => {
  const request = normalizeGenerationRequest(input);
  assert.deepEqual(request.references.map((reference) => reference.kind === 'https' ? reference.url : null), input.references.map(({ url }) => url));
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(request, candidate));
  assert.throws(() => validateCanonicalGenerationCapabilities({ ...request, settings: { ...request.settings, keyframeIndexes: '0,121' } }, candidate));
  const body = buildPaidVideoRequestBody({ quoteId: 'test-quote', request, engine: entry.engine, canonicalPricing: { membershipTier: 'member' } });
  assert.deepEqual(body.referenceImages, input.references.map(({ url }) => url));
  assert.deepEqual(body.extraInputValues, { reasoning_level: 'low', keyframe_indexes: '120,0' });
});

test('MCP advertises and enforces the workspace seed range without dropping zero', () => {
  const setting = projectAgentModelModeDetails(candidate, 'ref2v').settings.find(value => value.key === 'seed')!;
  assert.equal(setting.min, 0);
  assert.equal(setting.max, 2147483647);
  for (const seed of [0, 2147483647]) {
    const request = normalizeGenerationRequest({ ...input, settings: { ...input.settings, seed } });
    assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(request, candidate));
    assert.equal(buildPaidVideoRequestBody({ quoteId: 'test-quote', request, engine: entry.engine, canonicalPricing: { membershipTier: 'member' } }).seed, seed);
  }
  for (const seed of [-1, 2147483648]) {
    const request = normalizeGenerationRequest({ ...input, settings: { ...input.settings, seed } });
    assert.throws(() => validateCanonicalGenerationCapabilities(request, candidate));
  }
});

test('Studio model details teach the required keyframe units and reference pairing', () => {
  const details = studioVisualCapabilityDetails(candidate);
  assert.equal(details.surface, 'video');
  if (details.surface !== 'video') return;
  const keyframes = details.modes.find(mode => mode.mode === 'ref2v')!;
  const indexes = keyframes.settings.find(setting => setting.key === 'keyframeIndexes')!;
  assert.match(indexes.description ?? '', /comma-separated/i);
  assert.match(indexes.description ?? '', /reference order/i);
  assert.match(indexes.description ?? '', /24.*inclusive/i);
});
