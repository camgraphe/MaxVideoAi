import type { ExampleWatchDetail } from '../../frontend/lib/example-watch-detail';

export const detail = {
  id: 'public-example', title: 'Mountain observatory', prompt: 'A camera moves around an observatory. Keep the stars & snow.',
  videoUrl: 'https://media.maxvideoai.com/example.mp4', posterUrl: null, engineLabel: 'Kling 3',
  watchHref: '/video/mountain-observatory', modelHref: '/models/kling-3-pro', recreateHref: '/app?from=public-example',
  aspectRatio: '16:9', durationSec: 8, hasAudio: true,
  historicalCost: { amountCents: 999, currency: 'USD' }, quotes: [], references: [],
  scenario: { durationSec: 8, resolution: '1080p', aspectRatio: '16:9', audio: true, mode: 't2v' },
  context: { intro: '', visualContext: null, negativePrompt: 'No flicker', createdAt: '',
    details: [{ key: 'mode', label: 'Mode', value: 'Image to video' }],
    controls: [{ key: 'seed', label: 'Seed', value: '42' }, { key: 'image', label: 'Reference image', value: 'Provided' }],
    highlights: [], notes: [], engineDescription: '', engineBadges: [], compareLinks: [], keyframes: null },
} satisfies ExampleWatchDetail;
