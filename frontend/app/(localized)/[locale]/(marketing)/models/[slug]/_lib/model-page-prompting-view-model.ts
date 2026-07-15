import type { AppLocale } from '@/i18n/locales';

import type { FeaturedMedia } from './model-page-media';
import type { ModelPromptingContent } from './model-page-prompting-content';
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
  isImageEngine: boolean;
  supportsNativeAudio: boolean;
  useDemoMediaPrompt: boolean;
  demoMedia: FeaturedMedia | null;
  referenceWorkflows: Array<{ title: string; body: string }>;
};

const FALLBACK_DURATION_SECONDS = 12;
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
  const mediaPrompt = input.useDemoMediaPrompt
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
    demo: input.content.demo
      ? buildDemoViewModel(input, input.content.demo, ui)
      : null,
    imageExamples: input.content.imageExamples
      ? { ...input.content.imageExamples, workspaceHref: usePromptHref }
      : null,
    ui,
  };
}
