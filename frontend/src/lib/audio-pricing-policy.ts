/** First-party Audio clients must refresh after the commercial policy change. */
export const AUDIO_PRICING_POLICY_HEADER = 'x-maxvideoai-audio-pricing';
export const AUDIO_PRICING_POLICY_REVISION = 'tripled-rounded-2026-09-08';
export function isCurrentAudioPricingPolicy(headers: { get(name: string): string | null }) {
  return headers.get(AUDIO_PRICING_POLICY_HEADER) === AUDIO_PRICING_POLICY_REVISION;
}
