import { AUDIO_CINEMATIC_MAX_DURATION_SEC, getAudioPackConfig, type AudioPricingInput } from '@/lib/audio-generation';
import { NANO21_ENGINE_ID } from '@/lib/nano-banana-2-1';
import { estimateWebImageGeneration } from '@/server/images/estimate-image-generation';
import { computeBillingProductSnapshot } from '@/lib/billing-products';
import { computeCurrentAudioSnapshot } from '@/server/pricing/quote-public';
import { readRecastPublicPrice } from '@/server/character-studio/recast-public-price';
import { createScopedPublicPolicyLoader } from '@/server/pricing/scoped-public-policy';
import type { PublicModelQuote, PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';
import type { AppLocale } from '@/i18n/locales';
import { formatCurrencyForLocale } from './pricingPageContent';
import { getPricingHubCopy } from './pricingHubCopy';
import type { PricingHubData } from './pricingHubData';

type Amount = { totalCents: number; currency: string };
export type CurrentOtherPricingDependencies = {
  audio: (input: AudioPricingInput) => Promise<Amount>;
  product: (input: { productKey: string; quantity: number }) => Promise<Amount>;
  recast?: (input: PublicModelQuoteInput) => Promise<PublicModelQuote>;
};
/** The hub reserves eight workers for models; standalone callers retain twelve. */
type CurrentOtherPricingSchedule = { modelWorkersSettled: Promise<void> };
const defaults: CurrentOtherPricingDependencies = {
  audio: computeCurrentAudioSnapshot,
  product: async (input) => {
    const match = /^character-sheet-(1k|2k|4k)$/.exec(input.productKey);
    if (!match) return computeBillingProductSnapshot(input);
    const { pricing } = await estimateWebImageGeneration({ engineId: NANO21_ENGINE_ID, mode: 't2i', numImages: 1, resolution: match[1] });
    return pricing;
  },
};
const audioPresets: Record<string, Pick<AudioPricingInput, 'pack' | 'voiceMode'>> = {
  'audio-music-only': { pack: 'music_only' },
  'audio-voice-only': { pack: 'voice_only' },
  'audio-cinematic': { pack: 'cinematic' },
  'audio-cinematic-voice': { pack: 'cinematic_voice' },
  'audio-voice-clone': { pack: 'voice_only', voiceMode: 'clone' },
};
const toolPresets: Record<string, [string, string, number, number]> = {
  'character-builder-draft': ['character-sheet-1k', 'character-sheet-4k', 1, 1],
  'character-builder-final': ['character-sheet-2k', 'character-sheet-4k', 1, 1],
  'change-camera-angle': ['angle-flux-single', 'angle-qwen-single', 1, 1],
  'generate-best-angles': ['angle-flux-multi', 'angle-qwen-multi', 1, 1],
  'image-upscale': ['upscale-image-seedvr', 'upscale-image-topaz', 1, 1],
  'video-upscale': ['upscale-video-seedvr', 'upscale-video-topaz', 1, 1],
};

export async function buildCurrentOtherPricing(
  base: PricingHubData['otherSurfaces'], locale: AppLocale,
  dependencies: CurrentOtherPricingDependencies = defaults,
  schedule?: CurrentOtherPricingSchedule,
): Promise<PricingHubData['otherSurfaces']> {
  const copy = getPricingHubCopy(locale);
  const loadOverrides = createScopedPublicPolicyLoader();
  const recastQuote = dependencies.recast ?? (dependencies === defaults
    ? (input: PublicModelQuoteInput) => readRecastPublicPrice(input, { pricingPolicy: { loadOverrides } })
    : async () => ({ status: 'unavailable' as const }));
  const tasks: Array<() => Promise<void>> = [];
  const format = (quote: () => Promise<Amount>) => new Promise<string>((resolve) => tasks.push(async () => {
    try {
      const amount = await quote();
      if (!Number.isSafeInteger(amount.totalCents) || amount.totalCents < 0 || !amount.currency) throw new Error('Invalid price');
      resolve(formatCurrencyForLocale(locale, amount.currency, amount.totalCents / 100));
    } catch { resolve(copy.liveQuote); }
  }));
  const audioRows = Promise.all(base.audioRows.map(async (row) => {
    const preset = audioPresets[row.id];
    if (!preset) return { ...row, thirtySeconds: copy.liveQuote, sixtySeconds: copy.liveQuote, oneTwentySeconds: copy.liveQuote };
    if (getAudioPackConfig(preset.pack).requiresVideo) {
      const limit = locale === 'fr' ? 'Vidéo source : 10 s maximum.' : locale === 'es' ? 'Vídeo de origen: máximo 10 s.' : `Source video: ${AUDIO_CINEMATIC_MAX_DURATION_SEC} s maximum.`;
      return { ...row, thirtySeconds: copy.liveQuote, sixtySeconds: copy.liveQuote, oneTwentySeconds: copy.liveQuote, mode: `${row.mode} · ${limit}` };
    }
    const prices = await Promise.all([30, 60, 120].map((durationSec) => format(() => dependencies.audio({
      ...preset, durationSec, script: null, musicEnabled: true,
    }))));
    return { ...row, thirtySeconds: prices[0], sixtySeconds: prices[1], oneTwentySeconds: prices[2] };
  }));
  const toolRows = Promise.all(base.toolRows.map(async (row) => {
    const preset = toolPresets[row.id];
    if (!preset) return { ...row, standardOutput: copy.liveQuote, proOutput: copy.liveQuote };
    const values = await Promise.all([0, 1].map((index) => format(() => dependencies.product({
      productKey: index === 0 ? preset[0] : preset[1], quantity: index === 0 ? preset[2] : preset[3],
    }))));
    const minimum = locale === 'fr' ? 'minimum' : locale === 'es' ? 'mínimo' : 'minimum';
    const display = (original: string, amount: string) => {
      const prefix = original.includes(':') ? original.slice(0, original.indexOf(':') + 1) + ' ' : '';
      return `${prefix}${amount}${row.id === 'video-upscale' && amount !== copy.liveQuote ? ` · ${minimum} · ${copy.liveQuote}` : ''}`;
    };
    return { ...row, standardOutput: display(row.standardOutput, values[0]), proOutput: display(row.proOutput, values[1]) };
  }));
  const recastExamples = Promise.all([{ outputSeconds: 6, sourceSeconds: 0 }, { outputSeconds: 15, sourceSeconds: 15 }].map(async (scenario) => {
    const values = await Promise.all(['720p', '1080p'].map(resolution => format(async () => {
      const quote = await recastQuote({ modelId: 'wan-3-prime', mode: scenario.sourceSeconds ? 'v2v' : 'i2v',
        durationSec: scenario.outputSeconds, resolution, aspectRatio: '9:16', audio: false,
        ...(scenario.sourceSeconds ? { hasVideoInput: true, inputVideoDurationSec: scenario.sourceSeconds } : {}) });
      if (quote.status !== 'exact') throw new Error('Recast pricing is unavailable');
      return { totalCents: quote.amountCents, currency: quote.currency };
    })));
    return { ...scenario, price720: values[0], price1080: values[1] };
  }));
  let nextTask = 0;
  const work = async () => {
    while (nextTask < tasks.length) await tasks[nextTask++]();
  };
  const workers = Array.from({ length: Math.min(schedule ? 4 : 12, tasks.length) }, work);
  if (schedule) {
    // A fail-fast model rejection is not settlement: surviving workers still own their budget.
    workers.push(schedule.modelWorkersSettled.then(() =>
      Promise.all(Array.from({ length: Math.min(8, tasks.length) }, work)).then(() => undefined)));
  }
  await Promise.all(workers);
  return { ...base, audioRows: await audioRows, toolRows: await toolRows, recastExamples: await recastExamples };
}
