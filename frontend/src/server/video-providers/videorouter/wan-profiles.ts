// Prices include the usual 2.5% fee. The account's introductory discount can expire.
const HOST = 'botsmart';
const prime = { engineId: 'wan-3-prime', model: 'wan-3.0-prime' };
const standard = { engineId: 'wan-3', model: 'wan-3.0' };
const profiles = [
  { ...prime, resolution: '480p', aspectRatio: '16:9', mode: 't2v', images: 0, microsPerSecond: 39700,
    durations: [2, 3, 4, 5, 15] },
  { ...prime, resolution: '720p', aspectRatio: '16:9', mode: 't2v', images: 0, microsPerSecond: 79400 },
  { ...prime, resolution: '720p', aspectRatio: '16:9', mode: 'ref2v', images: 1, microsPerSecond: 79400 },
  { ...standard, resolution: '480p', aspectRatio: '9:16', mode: 'ref2v', images: 1, microsPerSecond: 22100 },
];

type WanProfileInput = {
  engineId: string; resolution: string; aspectRatio?: string | null; mode: string; images: number; durationSec: number;
};

export function findBotSmartProfile(input: WanProfileInput) {
  if (!Number.isInteger(input.durationSec) || input.durationSec < 2 || input.durationSec > 30) return;
  const profile = profiles.find(p => p.engineId === input.engineId && p.resolution === input.resolution.toLowerCase() &&
    p.aspectRatio === input.aspectRatio && p.mode === input.mode && p.images === input.images &&
    (!('durations' in p) || p.durations.includes(input.durationSec)));
  if (!profile) return;
  return {
    model: 'alibaba/' + profile.model + '/' + HOST,
    hostModel: HOST + '/' + profile.model,
    costMicros: Math.ceil(input.durationSec * profile.microsPerSecond * 1025 / 1000),
  };
}

export function botSmartModelForWan(model: string) {
  if (model === 'wan3.0-video-prime') return 'alibaba/' + prime.model + '/' + HOST;
  if (model === 'wan3.0-video') return 'alibaba/' + standard.model + '/' + HOST;
  return null;
}
