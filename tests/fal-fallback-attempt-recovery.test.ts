import assert from 'node:assert/strict';
import test from 'node:test';
import { submitKlingDirectGenerateTask } from '../frontend/app/api/generate/_lib/kling-direct-submission';
import { submitAlibabaModelStudioGenerateTask } from '../frontend/app/api/generate/_lib/alibaba-model-studio-submission';
import { submitLumaAgentsGenerateTask } from '../frontend/app/api/generate/_lib/luma-agents-submission';
import { submitGoogleVertexVeoGenerateTask } from '../frontend/app/api/generate/_lib/google-vertex-veo-submission';
import type { FalGenerateSubmissionResult } from '../frontend/app/api/generate/_lib/fal-submission';
import { KlingDirectError } from '../frontend/src/server/video-providers/kling-direct/errors';
import { AlibabaModelStudioError } from '../frontend/src/server/video-providers/alibaba-model-studio/errors';
import { LumaAgentsError } from '../frontend/src/server/video-providers/luma-agents/errors';
import { GoogleVertexVeoError } from '../frontend/src/server/video-providers/google-vertex-veo/errors';

const providers = [
  { name: 'Kling', engine: 'kling-3-turbo-standard', submit: submitKlingDirectGenerateTask,
    client: 'getKlingDirectClientFn', method: 'createTask', failure: new KlingDirectError('Account balance not enough', { status: 429, code: '1102' }) },
  { name: 'Alibaba', engine: 'wan-3', submit: submitAlibabaModelStudioGenerateTask,
    client: 'getAlibabaModelStudioClientFn', method: 'createVideo', failure: new AlibabaModelStudioError('Rate limited', { status: 429 }) },
  { name: 'Luma', engine: 'luma-ray-3-2', submit: submitLumaAgentsGenerateTask,
    client: 'getLumaAgentsClientFn', method: 'createGeneration', failure: new LumaAgentsError('Rate limited', { status: 429 }) },
  { name: 'Vertex', engine: 'veo-3-1', submit: submitGoogleVertexVeoGenerateTask,
    client: 'getGoogleVertexVeoClientFn', method: 'createTask', failure: new GoogleVertexVeoError('Service unavailable', { status: 503 }) },
] as const;

for (const provider of providers) {
  for (const outcome of ['deferred-known-id', 'deferred-unknown-id', 'terminal', 'invalid-202'] as const) {
    test(`${provider.name} fallback records ${outcome} without confusing accepted work with failure`, async () => {
      const deferred = outcome.startsWith('deferred');
      const providerJobId = outcome === 'deferred-unknown-id' ? null : 'fal-request';
      const falResult: FalGenerateSubmissionResult = { ok: false, status: deferred || outcome === 'invalid-202' ? 202 : 422,
        body: deferred ? { ok: true, jobId: 'job-recovery', status: 'running', deferred: true, providerJobId }
          : { ok: false, error: 'RENDER_REJECTED', providerJobId } };
      const queries: Array<{ sql: string; params: unknown[] }> = [];
      let attempt = 0, directCalls = 0, falCalls = 0;
      const queryFn = async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
        queries.push({ sql, params });
        return /INSERT INTO provider_attempts/.test(sql) ? [{ id: ++attempt, attempt_index: params[1] }] as T[] : [];
      };
      const result = await provider.submit({
        jobId: 'job-recovery', userId: 'owner', engineId: provider.engine, engineLabel: provider.name,
        mode: 't2v', prompt: 'A quiet valley', negativePrompt: null, durationSec: provider.name === 'Vertex' ? 8 : 5,
        aspectRatio: '16:9', audioEnabled: false, effectiveResolution: '720p', imageUrl: null, cfgScale: null,
        placeholderThumb: '/placeholder.svg', pricing: { totalCents: 328, currency: 'USD' }, paymentStatus: 'paid_wallet',
        pendingReceipt: null, paymentMode: 'wallet', walletChargeReserved: false, fallbackToFalEnabled: true,
        fallbackOnCreditsDepletedEnabled: true, elementRegistrationEnabled: false, advancedDirectOnlyEnabled: false,
        falPayload: { engineId: provider.engine, mode: 't2v', prompt: 'A quiet valley', durationSec: provider.name === 'Vertex' ? 8 : 5,
          aspectRatio: '16:9', resolution: '720p' },
        falInputSummary: { hasImage: false, hasVideo: false, imageCount: 0, videoCount: 0 }, isLumaRay2: false,
        batchId: null, groupId: null, iterationIndex: null, iterationCount: null, renderIds: null, heroRenderId: null, localKey: null,
        logMetricFn() {}, deps: { queryFn,
          [provider.client]: () => ({ [provider.method]: async () => { directCalls++; throw provider.failure; } }),
          submitFalGenerateTaskFn: async (params: { jobId: string }) => { assert.equal(params.jobId, 'job-recovery'); falCalls++; return falResult; },
        },
      } as never);
      assert.deepEqual(result, falResult);
      assert.equal(directCalls, 1);
      assert.equal(falCalls, 1);
      assert.equal(attempt, 2);
      assert.equal(queries.some(({ params }) => params[0] === 2 && params[3] === 'fal_fallback_failed'), !deferred);
      assert.equal(queries.some(({ params }) => params[0] === 1 && params[1] === 'failed'), true, 'retain the genuine direct-provider failure');
      if (deferred && providerJobId) assert.equal(queries.some(({ params }) => params[0] === 2 && params[1] === providerJobId), true);
    });
  }
}
