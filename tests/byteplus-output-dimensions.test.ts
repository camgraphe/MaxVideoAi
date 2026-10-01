import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { expectedBytePlusTokens, estimateBytePlusProviderCostCents } from '../frontend/server/byteplus-accounting';
import { normalBytePlusSupplierCost } from '../frontend/server/byteplus-normal-cost';
import { buildProviderCostComparisonRows, providerComparisonInputFromScenario } from '../frontend/server/pricing-admin/provider-cost-comparison';

const at = '2026-10-01T12:00:00Z';
// Official Create video task table: the 2.0 series has a different 480p raster from 2.5.
const rasters = [
  ['480p', '16:9', 864, 496], ['480p', '4:3', 752, 560], ['480p', '1:1', 640, 640],
  ['480p', '3:4', 560, 752], ['480p', '9:16', 496, 864], ['480p', '21:9', 992, 432],
  ['720p', '16:9', 1280, 720], ['720p', '4:3', 1112, 834], ['720p', '1:1', 960, 960],
  ['720p', '3:4', 834, 1112], ['720p', '9:16', 720, 1280], ['720p', '21:9', 1470, 630],
  ['1080p', '16:9', 1920, 1080], ['1080p', '4:3', 1664, 1248], ['1080p', '1:1', 1440, 1440],
  ['1080p', '3:4', 1248, 1664], ['1080p', '9:16', 1080, 1920], ['1080p', '21:9', 2206, 946],
  ['4k', '16:9', 3840, 2160], ['4k', '4:3', 3326, 2494], ['4k', '1:1', 2880, 2880],
  ['4k', '3:4', 2494, 3326], ['4k', '9:16', 2160, 3840], ['4k', '21:9', 4398, 1886],
] as const;

for (const modelId of ['seedance-2-0', 'seedance-2-0-mini', 'seedance-2-0-fast']) {
  test(`${modelId} provider accounting and admin use factual output dimensions independently of retail`, () => {
    const entry = getFalEngineById(modelId)!;
    const engine = { ...entry.engine, providerMeta: { ...entry.engine.providerMeta, provider: 'byteplus_modelark' } };
    for (const [resolution, aspectRatio, width, height] of rasters) {
      if (modelId !== 'seedance-2-0' && !['480p', '720p'].includes(resolution)) continue;
      const tokens = width * height * 4 * 24 / 1024;
      const label = `${resolution}/${aspectRatio}`;
      assert.equal(expectedBytePlusTokens({ engine_id: modelId, duration_sec: 4,
        settings_snapshot: { core: { resolution, aspectRatio } } }), tokens, label);
      for (const hasVideoInput of [false, true]) {
        const context = { engine, mode: 't2v' as const, durationSec: 4, resolution, aspectRatio, hasVideoInput };
        const cost = normalBytePlusSupplierCost(context, at)!;
        const input = providerComparisonInputFromScenario({ engine, context, executionProvider: 'byteplus_modelark',
          quote: null, brandId: entry.brandId, scenario: { id: label, engineId: modelId, mode: 't2v',
            resolution, durationSec: 4, surface: 'billing', input: { aspectRatio } } });
        assert.equal(input.videoTokens, tokens, label);
        assert.equal(cost.usage.videoTokens, tokens, label);
        assert.equal(buildProviderCostComparisonRows([input], at)[0].supplierList.amountUsd, cost.listAmountUsd, label);
        assert.equal(estimateBytePlusProviderCostCents({ engineId: modelId, durationSec: 4, resolution,
          aspectRatio, billingInputType: hasVideoInput ? 'video_input' : 'no_video_input' }),
          Math.ceil(cost.listAmountUsd * 100), label);
      }
    }
  });
}
