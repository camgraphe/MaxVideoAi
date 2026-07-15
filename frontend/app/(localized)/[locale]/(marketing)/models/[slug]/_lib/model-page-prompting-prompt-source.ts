import type { AppLocale } from '@/i18n/locales';

import type { FeaturedMedia } from './model-page-media';
import type { ModelPromptingContent } from './model-page-prompting-content';
import { getModelPromptingUiCopy } from './model-page-prompting-ui-copy';

export type ModelPromptingDemoPromptSource = 'editorial' | 'media';

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
