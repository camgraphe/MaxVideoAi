import { AUDIO_PACK_VALUES, AUDIO_LYRIA3_PRO_DURATION_OPTIONS_SEC, getAudioPackConfig, buildAudioPricingPresentation, type AudioPricingInput } from '@/lib/audio-generation';
import { getFalEngineById } from '@/config/falEngines';
import { buildPublicPricingFacts } from '@/lib/pricing-public-facts';
import type { PricingAuditScenario } from '@/lib/pricing-audit/types';

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
  return [...audio.values(), ...boards];
}

export function buildLiveProductPolicyFacts(scenario: PricingAuditScenario) {
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
