import type { AppLocale } from '@/i18n/locales';

import type { FeaturedMedia } from './model-page-media';
import type { ModelPromptingContent } from './model-page-prompting-content';
import type { ModelPromptingDemoPromptSource } from './model-page-prompting-prompt-source';
import {
  getModelPromptingUiCopy,
  type ModelPromptingUiCopy,
} from './model-page-prompting-ui-copy';

export type ModelPromptingViewModel = {
  id: string;
  section: ModelPromptingContent['section'];
  tabs: {
    items: ModelPromptingContent['tabs'];
    notesById: Record<string, string>;
    exampleHref: string | null;
    usePromptHref: string;
  };
  globalPrinciples: string[];
  engineWhy: string[];
  referenceWorkflows: Array<{ title: string; body: string }>;
  defaultPresentation: {
    locale: AppLocale;
    mode: 'image' | 'video';
    supportsAudio: boolean;
    demo: {
      media: FeaturedMedia;
      label: string;
      audioBadgeLabel: string;
      altContext: string;
      promptLabel: string | undefined;
      promptLines: string[];
    } | null;
  };
  demo: {
    title: string;
    promptLabel: string;
    prompt: string;
    notes: string[];
    summary: NonNullable<ModelPromptingContent['demo']>['summary'];
    modeLabel: string;
    outputLabel: string;
    durationLabel: string;
    aspectLabel: string;
    audioChipLabel: string;
    alt: string;
    posterSrc: string | null;
    videoSrc: string | null;
    fullHref: string | null;
  } | null;
  imageExamples: (NonNullable<ModelPromptingContent['imageExamples']> & {
    workspaceHref: string;
  }) | null;
  ui: ModelPromptingUiCopy;
};

export type BuildModelPromptingViewModelInput = {
  content: ModelPromptingContent;
  locale: AppLocale;
  engineId: string;
  modelSlug: string;
  imageAnchorId: string;
  isVideoEngine: boolean;
  isImageEngine: boolean;
  supportsNativeAudio: boolean;
  demoPromptSource: ModelPromptingDemoPromptSource;
  defaultDemoPromptSource: ModelPromptingDemoPromptSource;
  demoMedia: FeaturedMedia | null;
  defaultDemoPresentation: {
    audioBadgeLabel: string;
    altContext: string;
  };
  referenceWorkflows: Array<{ title: string; body: string }>;
};

const FALLBACK_DURATION_SECONDS = 8;
const FALLBACK_ASPECT_RATIO = '16:9';

function formatMediaDuration(media: FeaturedMedia | null, locale: AppLocale): string {
  const duration = typeof media?.durationSec === 'number'
    ? media.durationSec
    : FALLBACK_DURATION_SECONDS;
  return locale === 'fr' || locale === 'es' ? `${duration} s` : `${duration}s`;
}

function resolveMediaAspect(media: FeaturedMedia | null): string {
  const aspectRatio = media?.aspectRatio?.trim();
  return aspectRatio || FALLBACK_ASPECT_RATIO;
}

function resolveAudioChipLabel(
  input: BuildModelPromptingViewModelInput,
  presentation: NonNullable<ModelPromptingContent['demo']>['presentationOverrides'],
  ui: ModelPromptingUiCopy,
): string {
  if (presentation.audioChipLabel) return presentation.audioChipLabel;

  switch (presentation.audioChipMode) {
    case 'on':
      return ui.audioOn;
    case 'off':
      return ui.audioOff;
    case 'silent':
      return ui.silent;
    case 'supported':
      if (input.demoMedia) return input.demoMedia.hasAudio ? ui.audioOn : ui.audioOff;
      return input.supportsNativeAudio ? ui.audioOn : ui.audioOff;
    case 'media':
      return input.demoMedia?.hasAudio ? ui.audioOn : ui.audioOff;
  }
}

function buildDemoViewModel(
  input: BuildModelPromptingViewModelInput,
  demo: NonNullable<ModelPromptingContent['demo']>,
  ui: ModelPromptingUiCopy,
): NonNullable<ModelPromptingViewModel['demo']> {
  const presentation = demo.presentationOverrides;
  const mediaPrompt = input.demoPromptSource === 'media'
    ? input.demoMedia?.prompt?.trim()
    : null;

  return {
    title: demo.title,
    promptLabel: demo.promptLabel,
    prompt: mediaPrompt || demo.prompt,
    notes: demo.notes,
    summary: demo.summary,
    modeLabel: presentation.modeLabel,
    outputLabel: presentation.outputLabel,
    durationLabel: presentation.duration ?? formatMediaDuration(input.demoMedia, input.locale),
    aspectLabel: presentation.aspectRatio ?? resolveMediaAspect(input.demoMedia),
    audioChipLabel: resolveAudioChipLabel(input, presentation, ui),
    alt: presentation.altContext,
    posterSrc: input.demoMedia?.posterUrl ?? null,
    videoSrc: input.demoMedia?.videoUrl ?? input.demoMedia?.previewVideoUrl ?? null,
    fullHref: input.demoMedia?.href ?? null,
  };
}

export function buildModelPromptingViewModel(
  input: BuildModelPromptingViewModelInput,
): ModelPromptingViewModel {
  const ui = getModelPromptingUiCopy(input.locale);
  const workspaceBase = input.isImageEngine ? '/app/image' : '/app';
  const usePromptHref = `${workspaceBase}?engine=${encodeURIComponent(input.engineId)}`;

  return {
    id: input.imageAnchorId,
    section: input.content.section,
    tabs: {
      items: input.content.tabs,
      notesById: Object.fromEntries(
        input.content.tabNotes.map((note) => [note.tabId, note.body]),
      ),
      exampleHref: input.demoMedia?.href ?? null,
      usePromptHref,
    },
    globalPrinciples: input.content.globalPrinciples,
    engineWhy: input.content.engineWhy,
    referenceWorkflows: input.referenceWorkflows,
    defaultPresentation: {
      locale: input.locale,
      mode: input.isVideoEngine ? 'video' : 'image',
      supportsAudio: input.supportsNativeAudio,
      demo: input.content.demo && input.demoMedia
        ? {
            media: input.demoMedia,
            label: input.content.demo.title,
            audioBadgeLabel: input.defaultDemoPresentation.audioBadgeLabel,
            altContext: input.defaultDemoPresentation.altContext,
            promptLabel: input.defaultDemoPromptSource === 'media'
              ? undefined
              : input.content.demo.promptLabel,
            promptLines: input.defaultDemoPromptSource === 'media'
              ? []
              : input.content.demo.prompt.split('\n'),
          }
        : null,
    },
    demo: input.content.demo
      ? buildDemoViewModel(input, input.content.demo, ui)
      : null,
    imageExamples: input.content.imageExamples
      ? { ...input.content.imageExamples, workspaceHref: usePromptHref }
      : null,
    ui,
  };
}
