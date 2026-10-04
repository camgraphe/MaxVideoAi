import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import {
  priceCanonicalGeneration,
  priceCanonicalGenerationInExecutor,
} from '../frontend/src/server/agent-api/generation-pricing';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';

for (const engineId of ['gpt-image-2-5-flare', 'gpt-image-2-5-sunburst']) {
  for (const referenceCount of [0, 1, 3]) {
    test(`${engineId} preserves the prepared price and provider facts with ${referenceCount} references`, async () => {
      const entry = getFalEngineById(engineId);
      assert.ok(entry);
      const candidate: AgentPublicGenerationEngine = {
        engine: entry.engine, surface: 'image', publicModes: ['t2i', 'i2i'],
        modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])),
      };
      const request: CanonicalGenerationRequest = {
        schemaVersion: 1, surface: 'image', engineId,
        mode: referenceCount ? 'i2i' : 't2i',
        prompt: 'Make a calm editorial image using the attached direction.',
        settings: { resolution: 'landscape_16_9', aspectRatio: '16:9', quality: 'high', outputFormat: 'png' },
        outputCount: 1,
        references: Array.from({length: referenceCount}, (_, i) => ({
          kind: 'https' as const, role: 'reference' as const, mediaKind: 'image' as const,
          url: `https://assets.example.com/reference-${i}.png`,
        })),
      };
      const prepared = await priceCanonicalGeneration(request, 'member');
      const confirmed = await priceCanonicalGenerationInExecutor(request, 'member', {
        candidate, executor: { async query() { return []; } } as TransactionQueryExecutor,
      });
      for (const pricing of [prepared, confirmed]) {
        const meta = pricing.pricingSnapshot.meta as Record<string, unknown>;
        assert.equal(meta.reference_image_count, referenceCount);
        assert.equal(meta.included_reference_image_count, referenceCount ? 1 : 0);
        assert.equal(meta.additional_reference_image_count, referenceCount === 3 ? 2 : 0);
      }
      assert.deepEqual(confirmed, prepared);
    });
  }
}
