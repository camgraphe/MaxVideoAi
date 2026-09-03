import type { AppLocale } from '@/i18n/locales';
import { MODEL_LAUNCH_WAVES } from '@/config/model-launch-waves';

import type { FeaturedMedia } from './model-page-media';
import type { ModelPromptingContent } from './model-page-prompting-content';
import { getModelPromptingUiCopy } from './model-page-prompting-ui-copy';

export type ModelPromptingDemoPromptSource = 'editorial' | 'media';

const REVIEWED_LAUNCH_MODEL_IDS = new Set<string>(
  MODEL_LAUNCH_WAVES.flatMap((wave) => wave.models.map(({ modelId }) => modelId)),
);

export function resolveDefaultModelPromptingDemoPromptSource(
  demoMedia: FeaturedMedia | null,
): ModelPromptingDemoPromptSource {
  return demoMedia?.prompt?.trim() ? 'media' : 'editorial';
}

export function resolveModelPromptingDemoPromptSource({
  content,
  demoMedia,
  engineId,
  locale,
}: {
  content: ModelPromptingContent;
  demoMedia: FeaturedMedia | null;
  engineId: string;
  locale: AppLocale;
}): ModelPromptingDemoPromptSource {
  const demo = content.demo;
  if (!demo || !demoMedia?.prompt?.trim()) return 'editorial';
  if (REVIEWED_LAUNCH_MODEL_IDS.has(content.modelSlug)) return 'media';

  const ui = getModelPromptingUiCopy(locale);
  const summaryPrompt = [
    `${ui.subject}: ${demo.summary.subject}`,
    `${ui.action}: ${demo.summary.action}`,
    `${ui.camera}: ${demo.summary.camera}`,
    `${ui.style}: ${demo.summary.style}`,
    `${ui.audio}: ${demo.summary.output}`,
  ].join('\n');

  return engineId === 'happy-horse-1-1' || demo.prompt === summaryPrompt
    ? 'media'
    : 'editorial';
}
