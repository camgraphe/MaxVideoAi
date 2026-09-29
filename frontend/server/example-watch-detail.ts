import type { VideoSeoEditorialEntry } from '@/config/video-seo-editorial';
import { buildExampleRecreationHref, parseExampleRecreationSettings, publicExampleResolution } from '@/lib/example-recreation';
import type { ExampleWatchDetail } from '@/lib/example-watch-detail';
import { canRecreatePublicExample } from '@/lib/public-example-recreation';
import { buildExampleComparisonQuotes, type ExampleQuoteProvider } from './example-comparison-quotes';
import type { WatchPageDerivedSignals } from './watch-page-signals';
import { deriveWatchPageSignals } from './watch-page-signals';
import { parseSnapshot } from './watch-page-signals/snapshot';
import type { GalleryVideo } from './videos-normalization';

/** Explicit public DTO: never serialize ownership or the raw generation snapshot. */
export async function projectExampleWatchDetail(video: GalleryVideo, editorial: VideoSeoEditorialEntry | null, quote: ExampleQuoteProvider, preparedSignals?: WatchPageDerivedSignals): Promise<ExampleWatchDetail | null> {
  if (video.visibility !== 'public' || !video.indexable || !video.videoUrl) return null;
  const signals = preparedSignals ?? deriveWatchPageSignals({ video, editorial });
  const snapshot = parseSnapshot(video);
  const measuredResolution = publicExampleResolution(video.outputWidth ?? undefined, video.outputHeight ?? undefined);
  // Measured output wins over authored settings. Unknown measured sizes cannot claim a different resolution.
  const resolution = video.outputWidth && video.outputHeight ? measuredResolution : snapshot.core.resolution;
  const ratio = video.outputWidth && video.outputHeight ? video.outputWidth / video.outputHeight : Number((snapshot.core.aspectRatio ?? '').split(':')[0]) / Number((snapshot.core.aspectRatio ?? '').split(':')[1]);
  const aspectRatio = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].find(value => {
    const [w, h] = value.split(':').map(Number); return Math.abs(ratio / (w / h) - 1) < 0.02;
  });
  const proposed = { durationSec: video.durationSec, resolution: resolution ?? '', aspectRatio: aspectRatio ?? '', audio: video.hasAudio, mode: 't2v' as const };
  const scenario = parseExampleRecreationSettings(new URLSearchParams(buildExampleRecreationHref(video.id, video.engineId, proposed).split('?')[1]));
  const quotes = await buildExampleComparisonQuotes(video, scenario, quote);
  return {
    id: video.id, title: signals.title, prompt: signals.promptText, videoUrl: video.videoUrl,
    posterUrl: video.thumbUrl ?? null, engineLabel: signals.engineLabel,
    watchHref: new URL(signals.canonicalUrl).pathname, modelHref: signals.modelPath,
    recreateHref: canRecreatePublicExample(video.engineId) ? signals.recreatePath : null,
    aspectRatio: signals.aspectRatio ?? video.aspectRatio ?? '16:9',
    durationSec: video.durationSec, hasAudio: video.hasAudio,
    historicalCost: typeof video.finalPriceCents === 'number' && video.currency ? { amountCents: video.finalPriceCents, currency: video.currency } : null,
    scenario, quotes,
    references: signals.sourceImages.map(({ key, label, url, alt, thumbUrl }) => ({ key, label, url, alt, ...(thumbUrl ? {thumbUrl} : {}) })),
    context: {
      intro: signals.intro, visualContext: signals.seoPromptContext, negativePrompt: signals.negativePrompt,
      createdAt: video.createdAt, details: signals.detailRows, controls: [...signals.promptRows,...signals.inputRows],
      highlights: signals.whatThisShows, notes: signals.promptImprovementNotes, engineDescription: signals.engineDescription,
      engineBadges: signals.engineBadges, compareLinks: signals.compareLinks, keyframes: video.keyframeUrls ?? null,
    },
  };
}
