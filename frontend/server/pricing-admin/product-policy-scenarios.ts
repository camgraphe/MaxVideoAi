import { AUDIO_PACK_VALUES, AUDIO_LYRIA3_PRO_DURATION_OPTIONS_SEC, getAudioPackConfig, buildAudioPricingPresentation, type AudioPricingInput } from '@/lib/audio-generation';
import { getFalEngineById } from '@/config/falEngines';
import { buildPublicPricingFacts } from '@/lib/pricing-public-facts';
import type { PricingAuditScenario } from '@/lib/pricing-audit/types';
import { FINISHING_TOOL_IDS, FINISHING_QUALITY_CHOICES, defaultFinishingSettings, finishingSettingsSchemas, isFinishingToolId } from '@/lib/toolbox/finishing';
import { estimateFinishingVendorBudget } from '@/server/tools/finishing-providers';

/** Representative prices, including block boundaries. This is not a continuous coverage certificate. */
function buildFinishingPolicyScenarios(): PricingAuditScenario[] {
  const scenarios: PricingAuditScenario[] = [];
  for (const toolId of FINISHING_TOOL_IDS) for (const quality of FINISHING_QUALITY_CHOICES[toolId]) {
    const options = toolId === 'restore-video' ? [{ outputResolution: '1080p' }, { outputResolution: '4k' }]
      : toolId === 'smooth-motion' ? [{ targetFps: 60 }, { targetFps: 120 }] : [{}];
    for (const [width, height] of [[1280, 720], [1920, 1080], [3840, 2160]]) for (const fps of [30, 60]) {
      for (const durationSec of [5, 10, 10.01, 30, 60]) for (const option of options) {
        if ('targetFps' in option && Number(option.targetFps) <= fps) continue;
        scenarios.push({ id: `admin-finishing:${toolId}:${quality}:${width}x${height}:${fps}:${durationSec}:${Object.values(option).join('')}`,
          surface: 'tool', engineId: 'toolbox-finishing', mode: `${toolId}:${quality}`, resolution: 'video',
          durationSec, membershipTier: 'member', compatibilityProfile: 'standard',
          input: { adminProduct: 'finishing', toolId, quality, width, height, fps, ...option,
            scenarioLabel: `${toolId.replaceAll('-', ' ')} · ${quality} · ${durationSec} s · ${width} × ${height} · ${fps} fps${'outputResolution' in option ? ` → ${option.outputResolution}` : 'targetFps' in option ? ` → ${option.targetFps} fps` : ''}` } });
      }
    }
  }
  return scenarios;
}

/** Authored comparison inputs only; commercial amounts stay in the canonical quote. */
export function buildAdminAudioReferenceInputs(durationSec: number) {
  return AUDIO_PACK_VALUES.flatMap((pack) => {
    const config = getAudioPackConfig(pack);
    const variants: Array<Partial<AudioPricingInput> & { label: string }> = pack === 'music_only'
      ? [{ musicModel: 'clip', label: 'Lyria 3 Clip' }, { musicModel: 'pro', label: 'Lyria 3 Pro' }]
      : config.includesVoice ? [{ voiceModel: 'seed', voiceMode: 'standard', label: 'Seed Audio' },
        { voiceModel: 'seed', voiceMode: 'clone', label: 'Seed Audio reference voice' },
        { voiceModel: 'minimax', voiceMode: 'standard', script: 'a'.repeat(1000), label: 'MiniMax Speech HD · 1,000 characters' }]
        : [{ label: config.label }];
    return variants.map(({ label, ...variant }, index) => {
      const seconds = pack === 'song' ? 3 : config.requiresVideo ? Math.min(10, durationSec) : pack === 'sfx_only' ? Math.min(30, durationSec)
        : pack === 'music_only' && variant.musicModel === 'clip' ? 30
        : pack === 'music_only' ? AUDIO_LYRIA3_PRO_DURATION_OPTIONS_SEC.find((value) => value >= durationSec) ?? 184 : durationSec;
      return { id: `audio:${pack}:${index}`, label: `${config.label}${label === config.label ? '' : ` · ${label}`}`,
        input: { pack, durationSec: seconds, musicEnabled: config.defaultMusicEnabled, mood: 'epic', ...variant } as AudioPricingInput };
    });
  });
}

export function buildLiveProductPolicyScenarios(): PricingAuditScenario[] {
  const audio = new Map<string, PricingAuditScenario>();
  for (const duration of [3, 5, 10, 30, 60, 120, 184]) for (const { id, input } of buildAdminAudioReferenceInputs(duration)) {
    const scenarioId = `admin-${id}:${input.durationSec}`;
    audio.set(scenarioId, { id: scenarioId, surface: 'audio', engineId: 'audio-generation', mode: input.pack,
      resolution: 'audio', durationSec: input.durationSec, membershipTier: 'member', input: { ...input, adminProduct: 'audio' } as PricingAuditScenario['input'] });
  }
  const boards: PricingAuditScenario[] = (['storyboard', 'storyboard_edit'] as const).flatMap((mode) =>
    (['hd', '4k', 'ultra'] as const).map((resolution) => ({ id: `admin-storyboard:${mode}:${resolution}`, surface: 'tool',
      engineId: 'storyboarder', mode, resolution, durationSec: 1, membershipTier: 'member', input: { adminProduct: 'storyboard' } })));
  return [...audio.values(), ...boards, ...buildFinishingPolicyScenarios()];
}

export function buildLiveProductPolicyFacts(scenario: PricingAuditScenario) {
  if (scenario.input.adminProduct === 'finishing') {
    const toolId = String(scenario.input.toolId);
    if (!isFinishingToolId(toolId)) throw new Error('Unknown finishing pricing scenario.');
    const settings = finishingSettingsSchemas[toolId].parse({ ...defaultFinishingSettings(toolId), quality: scenario.input.quality,
      ...(toolId === 'restore-video' ? { resolution: scenario.input.outputResolution } : {}),
      ...(toolId === 'smooth-motion' ? { fps: scenario.input.targetFps } : {}) });
    const budgetUsd = estimateFinishingVendorBudget(toolId, settings, { width: Number(scenario.input.width),
      height: Number(scenario.input.height), fps: Number(scenario.input.fps), durationSec: scenario.durationSec! });
    return { engineId: scenario.engineId, currency: 'USD', vendorSubtotalExactCents: budgetUsd * 100, unit: 'video', quantity: 1 };
  }
  if (scenario.input.adminProduct === 'audio') {
    const input = { ...scenario.input, pack: scenario.mode, durationSec: scenario.durationSec } as AudioPricingInput;
    const facts = buildAudioPricingPresentation(input);
    return { engineId: scenario.engineId, currency: 'USD', vendorSubtotalExactCents: facts.vendorSubtotalCents,
      unit: facts.base.unit ?? 'audio', quantity: facts.durationSec };
  }
  if (scenario.input.adminProduct === 'storyboard') {
    const engine = getFalEngineById('gpt-image-2')!.engine;
    const { base } = buildPublicPricingFacts({ engine, durationSec: 1, mode: scenario.mode === 'storyboard_edit' ? 'i2i' : 't2i',
      resolution: scenario.resolution === 'hd' ? '1920x1080' : '3840x2160', quality: scenario.resolution === 'ultra' ? 'high' : 'medium',
      referenceImageCount: scenario.mode === 'storyboard_edit' ? 1 : 0 });
    // Storyboard's canonical projection bills the underlying image base, not its retail total.
    return { engineId: scenario.engineId, currency: 'USD', vendorSubtotalExactCents: base.amountCents,
      unit: base.unit ?? 'image', quantity: base.seconds };
  }
  return null;
}
