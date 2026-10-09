import { AUDIO_CINEMATIC_MAX_DURATION_SEC, getAudioPackConfig, type AudioPricingInput } from '@/lib/audio-generation';
import { getCharacterFormatMultiplier } from '@/lib/character-builder';
import { computeBillingProductSnapshot } from '@/lib/billing-products';
import { computeCurrentAudioSnapshot } from '@/server/pricing/quote-public';
import type { AppLocale } from '@/i18n/locales';
import { formatCurrencyForLocale } from './pricingPageContent';
import { getPricingHubCopy } from './pricingHubCopy';
import type { PricingHubData } from './pricingHubData';

type Amount = { totalCents: number; currency: string };
export type CurrentOtherPricingDependencies = {
  audio: (input: AudioPricingInput) => Promise<Amount>;
  product: (input: { productKey: string; quantity: number }) => Promise<Amount>;
};
const defaults: CurrentOtherPricingDependencies = {
  audio: computeCurrentAudioSnapshot,
  product: computeBillingProductSnapshot,
};
const audioPresets: Record<string, Pick<AudioPricingInput, 'pack' | 'voiceMode'>> = {
  'audio-music-only': { pack: 'music_only' },
  'audio-voice-only': { pack: 'voice_only' },
  'audio-cinematic': { pack: 'cinematic' },
  'audio-cinematic-voice': { pack: 'cinematic_voice' },
  'audio-voice-clone': { pack: 'voice_only', voiceMode: 'clone' },
};
const toolPresets: Record<string, [string, string, number, number]> = {
  'character-builder-draft': ['character-draft', 'character-draft', 1, getCharacterFormatMultiplier('4k', 'draft')],
  'character-builder-final': ['character-final', 'character-final', 1, getCharacterFormatMultiplier('4k', 'final')],
  'change-camera-angle': ['angle-flux-single', 'angle-qwen-single', 1, 1],
  'generate-best-angles': ['angle-flux-multi', 'angle-qwen-multi', 1, 1],
  'image-upscale': ['upscale-image-seedvr', 'upscale-image-topaz', 1, 1],
  'video-upscale': ['upscale-video-seedvr', 'upscale-video-topaz', 1, 1],
};

export async function buildCurrentOtherPricing(
  base: PricingHubData['otherSurfaces'], locale: AppLocale,
  dependencies: CurrentOtherPricingDependencies = defaults,
): Promise<PricingHubData['otherSurfaces']> {
  const copy = getPricingHubCopy(locale);
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
  let nextTask = 0;
  await Promise.all(Array.from({ length: Math.min(12, tasks.length) }, async () => {
    while (nextTask < tasks.length) await tasks[nextTask++]();
  }));
  return { ...base, audioRows: await audioRows, toolRows: await toolRows };
}
