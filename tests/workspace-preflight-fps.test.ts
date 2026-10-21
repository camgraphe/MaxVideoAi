import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkspacePreflightRequest } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-preflight-request';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { parsePreflightRequestPayload } from '../frontend/app/api/preflight/_lib/preflight-request';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { validateRuntimeRequestSettings } from '../frontend/app/api/generate/_lib/runtime-schema-options';

for (const mode of ['t2v', 'i2v', 'fl2v', 'ref2v'] as const) {
  test(`Max ${mode} workspace reaches pricing without sending its internal FPS as a provider option`, async () => {
    const engine = getFalEngineById('flux-3-max')!.engine;
    const form = coerceFormState(engine, mode, null);
    const request = buildWorkspacePreflightRequest({ form, selectedEngine: engine, submissionMode: mode,
      effectiveDurationSec: 5, supportsAudioToggle: true, voiceControlEnabled: false,
      inputAssets: {}, memberTier: 'Member' });
    assert.equal(form.fps, 24, 'The internal frame clock remains available to the keyframe editor.');
    assert.equal(Object.hasOwn(request, 'fps'), false);
    const parsed = parsePreflightRequestPayload(JSON.parse(JSON.stringify(request)));
    assert.equal(parsed.ok, true, JSON.stringify(parsed));
    if (!parsed.ok) return;
    const response = await resolveMediaAwarePreflight({ request: parsed.request, userId: null }, {
      getConfiguredEngineFn: async () => engine,
      computeConfiguredPreflightFn: async () => ({ ok: true, total: 111, messages: [] }),
    });
    assert.equal(response.ok, true, JSON.stringify(response));
    assert.equal(response.total, 111);
    assert.equal(validateRuntimeRequestSettings({ engine, mode, fps: 24 }).ok, false,
      'Explicit unsupported provider settings remain invalid.');
  });
}

test('preflight retains a supported cadence and rejects invalid cadence on FPS-enabled modes', () => {
  const engine = getFalEngineById('ltx-2-5-pro')!.engine;
  const form = coerceFormState(engine, 't2v', null);
  const request = buildWorkspacePreflightRequest({ form, selectedEngine: engine, submissionMode: 't2v',
    effectiveDurationSec: form.durationSec, supportsAudioToggle: true, voiceControlEnabled: false,
    inputAssets: {}, memberTier: 'Member' });
  assert.equal(request.fps, form.fps);
  assert.equal(parsePreflightRequestPayload(request).ok, true);
  assert.equal(validateRuntimeRequestSettings({ engine, mode: 't2v', fps: request.fps }).ok, true);
  assert.equal(validateRuntimeRequestSettings({ engine, mode: 't2v', fps: 239 }).ok, false);
  assert.equal(parsePreflightRequestPayload({ ...request, fps: '24' }).ok, false);
  assert.equal(parsePreflightRequestPayload({ ...request, fps: 0 }).ok, false);
});
