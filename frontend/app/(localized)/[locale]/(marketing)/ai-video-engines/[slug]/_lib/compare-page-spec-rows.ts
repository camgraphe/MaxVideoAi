import type {
  ComparePricingDisplay,
  CompareSpecValues,
  EngineCatalogEntry,
} from './compare-page-types';
import { isPending } from './compare-page-helpers';
import { localeRegions, type AppLocale } from '@/i18n/locales';
import type { PublicBenchmarkLatency } from '@/server/benchmark-lab-metrics';

export type CompareSpecRow = {
  label: string;
  left: string;
  right: string;
  subline?: string | null;
  sublines?: string[];
  rightSubline?: string | null;
  rightSublines?: string[];
  kind?: 'latency';
};

function latencyContext(row: PublicBenchmarkLatency | null | undefined, locale: AppLocale): string | null {
  if (!row) return null;
  const date = new Intl.DateTimeFormat(localeRegions[locale], {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(row.asOf));
  return `P90: ${Math.round(row.p90DurationMs / 1000)}s · ${date}`;
}

export function buildCompareSpecRows({
  leftSpecs,
  rightSpecs,
  leftPricingDisplay,
  rightPricingDisplay,
  pairHasNativeAudio,
  specLabels,
  activeLocale = 'en',
  leftLatency,
  rightLatency,
}: {
  left: EngineCatalogEntry;
  right: EngineCatalogEntry;
  leftSpecs: CompareSpecValues;
  rightSpecs: CompareSpecValues;
  leftPricingDisplay: ComparePricingDisplay;
  rightPricingDisplay: ComparePricingDisplay;
  pairHasNativeAudio: boolean;
  specLabels: Record<string, string>;
  activeLocale?: AppLocale;
  leftLatency?: PublicBenchmarkLatency | null;
  rightLatency?: PublicBenchmarkLatency | null;
}): CompareSpecRow[] {
  return [
    {
      label: specLabels.pricing ?? 'Pricing (MaxVideoAI)',
      left: leftPricingDisplay.headline,
      right: rightPricingDisplay.headline,
      subline: leftPricingDisplay.subline,
      sublines: leftPricingDisplay.secondaryLines,
      rightSubline: rightPricingDisplay.subline,
      rightSublines: rightPricingDisplay.secondaryLines,
    },
    { label: specLabels.textToVideo ?? 'Text-to-Video', left: leftSpecs.textToVideo, right: rightSpecs.textToVideo },
    { label: specLabels.imageToVideo ?? 'Image-to-Video', left: leftSpecs.imageToVideo, right: rightSpecs.imageToVideo },
    { label: specLabels.videoToVideo ?? 'Video-to-Video', left: leftSpecs.videoToVideo, right: rightSpecs.videoToVideo },
    { label: specLabels.firstLastFrame ?? 'First/Last frame', left: leftSpecs.firstLastFrame, right: rightSpecs.firstLastFrame },
    {
      label: specLabels.referenceImageStyle ?? 'Reference image / style reference',
      left: leftSpecs.referenceImageStyle,
      right: rightSpecs.referenceImageStyle,
    },
    { label: specLabels.referenceVideo ?? 'Reference video', left: leftSpecs.referenceVideo, right: rightSpecs.referenceVideo },
    { label: specLabels.maxResolution ?? 'Max resolution', left: leftSpecs.maxResolution, right: rightSpecs.maxResolution },
    { label: specLabels.maxDuration ?? 'Max duration', left: leftSpecs.maxDuration, right: rightSpecs.maxDuration },
    {
      kind: 'latency' as const,
      label: specLabels.observedMedian ?? 'Observed median (30 days)',
      left: leftLatency ? `${Math.round(leftLatency.medianDurationMs / 1000)}s` : 'Data pending',
      right: rightLatency ? `${Math.round(rightLatency.medianDurationMs / 1000)}s` : 'Data pending',
      subline: latencyContext(leftLatency, activeLocale),
      rightSubline: latencyContext(rightLatency, activeLocale),
    },
    { label: specLabels.aspectRatios ?? 'Aspect ratios', left: leftSpecs.aspectRatios, right: rightSpecs.aspectRatios },
    { label: specLabels.fpsOptions ?? 'FPS options', left: leftSpecs.fpsOptions, right: rightSpecs.fpsOptions },
    { label: specLabels.outputFormats ?? 'Output format', left: leftSpecs.outputFormats, right: rightSpecs.outputFormats },
    ...(pairHasNativeAudio
      ? [
          { label: specLabels.audioOutput ?? 'Audio output', left: leftSpecs.audioOutput, right: rightSpecs.audioOutput },
          {
            label: specLabels.nativeAudioGeneration ?? 'Native audio generation',
            left: leftSpecs.nativeAudioGeneration,
            right: rightSpecs.nativeAudioGeneration,
          },
          { label: specLabels.lipSync ?? 'Lip sync', left: leftSpecs.lipSync, right: rightSpecs.lipSync },
        ]
      : []),
    {
      label: specLabels.cameraMotionControls ?? 'Camera / motion controls',
      left: leftSpecs.cameraMotionControls,
      right: rightSpecs.cameraMotionControls,
    },
    { label: specLabels.watermark ?? 'Watermark', left: leftSpecs.watermark, right: rightSpecs.watermark },
  ].filter((row) => !(isPending(row.left) && isPending(row.right)));
}
