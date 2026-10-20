import type { AppLocale } from '@/i18n/locales';
import type { PublicKeyframeDemo } from '@/lib/public-keyframe-demo';
import type { ModelExamplesContent } from './model-page-examples-content';

export function buildModelKeyframeDemoViewModel(
  demo: PublicKeyframeDemo | null,
  copy: ModelExamplesContent['keyframeDemo'],
  locale: AppLocale,
  appGenerationEnabled: boolean,
) {
  if (!demo || !copy) return null;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
  const images = demo.recipe.keyframes.map((frame, index) => ({
    ...frame, number: index + 1, seconds: frame.frameIndex / 24,
    caption: demo.referenceCaptions?.[index]?.[locale] ?? null,
    timeLabel: `${number.format(frame.frameIndex / 24)} ${copy.secondsLabel}`,
  }));
  return {
    ...demo, copy, locale, images,
    timeline: [...images].sort((a, b) => a.frameIndex - b.frameIndex),
    recreateHref: appGenerationEnabled
      ? `/app?engine=${encodeURIComponent(demo.recipe.engineId)}&from=${encodeURIComponent(demo.recipe.jobId)}` : null,
  };
}

export type ModelKeyframeDemoViewModel = NonNullable<ReturnType<typeof buildModelKeyframeDemoViewModel>>;
