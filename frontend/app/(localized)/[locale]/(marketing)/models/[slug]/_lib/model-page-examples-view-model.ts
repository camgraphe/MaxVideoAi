import {
  AudioLines,
  Image as ImageIcon,
  Maximize2,
  PenLine,
  ShieldCheck,
  Sparkles,
  Type,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import type { ExampleGalleryVideo } from '@/components/examples/examples-gallery-types';
import type { AppLocale } from '@/i18n/locales';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import { deriveShortPromptLabel, getImageAlt, inferRenderTag } from '@/lib/image-alt';

import type {
  DecisionExampleFilterId,
  ModelExampleFilter,
  ModelExampleIconId,
  ModelExamplesContent,
} from './model-page-examples-content';
import {
  formatEmptyExamplesLabel,
  type ModelExamplesUiCopy,
} from './model-page-examples-ui-copy';

export type ModelExamplesGalleryItem = {
  id: string;
  href: string;
  posterUrl: string;
  alt: string;
  audioBadgeLabel: string | null;
  durationLabel: string | null;
  aspectRatio: string | null;
  category: string;
  title: string;
  recreateHref: string | null;
  recreateLabel: string | null;
  tags: DecisionExampleFilterId[];
};

export type BuildModelExamplesViewModelInput = {
  content: ModelExamplesContent;
  ui: ModelExamplesUiCopy;
  locale: AppLocale;
  anchorId: string;
  modelName: string;
  mode: 'video' | 'image-fallback';
  audioMode: 'runtime' | 'silent';
  decisionAltMode: 'preview-alt' | 'model-name-prefix';
  galleryVideos: readonly ExampleGalleryVideo[];
  galleryPreviewAlts: ReadonlyMap<string, string>;
  fallbackPosters: ReadonlyMap<string, string>;
  examplesLinkHref: LocalizedLinkHref;
  imageWorkspaceHref: string;
};

export type ModelExamplesViewModel = {
  visible: boolean;
  anchorId: string;
  section: ModelExamplesContent['section'];
  filters: ModelExampleFilter[];
  proofItems: Array<Omit<ModelExamplesContent['proofItems'][number], 'icon'> & { icon: LucideIcon }>;
  decision: {
    items: ModelExamplesGalleryItem[];
    examplesLinkHref: LocalizedLinkHref | null;
    viewAllLabel: string;
    renderLinkLabel: string;
    emptyLabel: string;
    noPreviewLabel: string;
  };
  defaultPresentation: {
    items: Array<{
      id: string;
      href: LocalizedLinkHref;
      posterUrl: string;
      alt: string;
      metadataLabel: string;
      recreateHref: LocalizedLinkHref | null;
      recreateLabel: string | null;
    }>;
    examplesLinkHref: LocalizedLinkHref;
    renderLinkLabel: string;
    noPreviewLabel: string;
  };
};

const MODEL_EXAMPLE_ICON_BY_ID: Record<ModelExampleIconId, LucideIcon> = {
  audio: AudioLines,
  image: ImageIcon,
  maximize: Maximize2,
  pen: PenLine,
  shield: ShieldCheck,
  sparkles: Sparkles,
  type: Type,
  users: Users,
  zap: Zap,
};

function formatDuration(video: ExampleGalleryVideo, locale: AppLocale): string {
  return locale === 'fr' || locale === 'es' ? `${video.durationSec} s` : `${video.durationSec}s`;
}

function getDisplayAspectRatio(video: ExampleGalleryVideo): string | null {
  const raw = video.aspectRatio?.trim();
  if (!raw) return null;
  if (/^(16:9|9:16|1:1|4:3|3:4|21:9)$/i.test(raw)) return raw;
  const match = raw.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return raw;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height === 0) return raw;
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.08) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.08) return '9:16';
  if (Math.abs(ratio - 1) < 0.04) return '1:1';
  return raw;
}

function getCategory(video: ExampleGalleryVideo, locale: AppLocale): string {
  const tag = inferRenderTag(video.promptFull ?? video.prompt, locale);
  if (tag) return tag;
  if (video.hasAudio) return locale === 'fr' ? 'Cinématique' : locale === 'es' ? 'Cinemático' : 'Cinematic';
  return 'Render';
}

function getVideoTags(
  video: ExampleGalleryVideo,
  category: string,
  aspectRatio: string | null,
  audioMode: BuildModelExamplesViewModelInput['audioMode'],
): DecisionExampleFilterId[] {
  const categoryText = category.toLowerCase();
  const titleText = deriveShortPromptLabel(video.promptFull ?? video.prompt, 'en').toLowerCase();
  const tags = new Set<DecisionExampleFilterId>();
  if (video.hasAudio && audioMode !== 'silent') tags.add('audio');
  if (aspectRatio === '9:16') tags.add('vertical');
  if (/\b(action|parkour|run|running|chase|combat|sport)\b/.test(`${categoryText} ${titleText}`)) tags.add('action');
  if (/\b(product|produit|producto|ad|pub|anuncio|lifestyle|clothing|try-on|brand|branded)\b/.test(categoryText)) tags.add('product');
  if (/\b(cinematic|cinematique|cinématique|cinematico|cinemático|narrative|narratif|narrativa|romance|film|filmique)\b/.test(categoryText)) tags.add('cinematic');
  return Array.from(tags);
}

function getImageTags(video: ExampleGalleryVideo, category: string): DecisionExampleFilterId[] {
  const title = deriveShortPromptLabel(video.promptFull ?? video.prompt, 'en').toLowerCase();
  const text = `${category.toLowerCase()} ${title}`;
  const tags = new Set<DecisionExampleFilterId>();
  if (/\b(campaign|campagne|campaña|ad|poster|launch)\b/.test(text)) tags.add('campaign');
  if (/\b(type|typography|typographie|tipograf)\b/.test(text)) tags.add('typography');
  if (/\b(reference|référence|referencia|edit|retouche|edici)/.test(text)) tags.add('reference');
  if (/\b(4k|final)\b/.test(text)) tags.add('final');
  return Array.from(tags);
}

function getDecisionAlt(
  input: BuildModelExamplesViewModelInput,
  video: ExampleGalleryVideo,
  title: string,
): string {
  if (input.decisionAltMode === 'model-name-prefix') {
    return `${input.modelName} ${title.toLowerCase()}`;
  }
  return input.galleryPreviewAlts.get(video.id) ?? `${video.engineLabel} example: ${title}`;
}

function buildGalleryItems(input: BuildModelExamplesViewModelInput): ModelExamplesGalleryItem[] {
  return input.galleryVideos.map((video) => {
    const title = deriveShortPromptLabel(video.promptFull ?? video.prompt, input.locale);
    const category = getCategory(video, input.locale);
    const aspectRatio = getDisplayAspectRatio(video);
    const isImage = input.mode === 'image-fallback';
    return {
      id: video.id,
      href: video.href,
      posterUrl: video.optimizedPosterUrl ?? video.rawPosterUrl ?? '',
      alt: getDecisionAlt(input, video, title),
      audioBadgeLabel: isImage
        ? null
        : input.audioMode === 'silent'
          ? input.ui.silentLabel
          : video.hasAudio ? input.ui.audioOnLabel : input.ui.audioOffLabel,
      durationLabel: isImage ? null : formatDuration(video, input.locale),
      aspectRatio,
      category,
      title,
      recreateHref: video.recreateHref ?? null,
      recreateLabel: input.content.section.recreateLabel,
      tags: isImage
        ? getImageTags(video, category)
        : getVideoTags(video, category, aspectRatio, input.audioMode),
    };
  });
}

function buildFallbackItems(input: BuildModelExamplesViewModelInput): ModelExamplesGalleryItem[] {
  if (input.mode !== 'image-fallback' || !input.content.fallbackItems) return [];
  return input.content.fallbackItems.map((item) => ({
    id: `${input.content.modelSlug}-fallback-${item.id}`,
    href: input.imageWorkspaceHref,
    posterUrl: input.fallbackPosters.get(item.id) ?? '',
    alt: item.alt,
    audioBadgeLabel: null,
    durationLabel: null,
    aspectRatio: item.aspectRatio,
    category: item.category,
    title: item.title,
    recreateHref: input.imageWorkspaceHref,
    recreateLabel: input.content.section.recreateLabel,
    tags: [...item.tags],
  }));
}

function buildDefaultItems(input: BuildModelExamplesViewModelInput) {
  return input.galleryVideos.slice(0, 6).map((video) => ({
    id: video.id,
    href: video.href,
    posterUrl: video.optimizedPosterUrl ?? video.rawPosterUrl ?? '',
    alt: input.galleryPreviewAlts.get(video.id) ?? getImageAlt({
      kind: 'renderThumb',
      engine: video.engineLabel,
      label: video.prompt,
      prompt: video.prompt,
      locale: input.locale,
    }),
    metadataLabel: [
      video.aspectRatio ?? 'Auto',
      formatDuration(video, input.locale),
      (video.hasAudio ? input.ui.audioOnLabel : input.ui.audioOffLabel).toLowerCase(),
    ].join(' · '),
    recreateHref: video.recreateHref ?? null,
    recreateLabel: input.content.section.recreateLabel,
  }));
}

export function buildModelExamplesViewModel(
  input: BuildModelExamplesViewModelInput,
): ModelExamplesViewModel {
  const galleryItems = buildGalleryItems(input);
  const items = galleryItems.length ? galleryItems : buildFallbackItems(input);
  const availableIds = new Set(items.flatMap((item) => item.tags));
  return {
    visible: items.length > 0 || input.content.showWhenEmpty,
    anchorId: input.anchorId,
    section: input.content.section,
    filters: input.content.filters.filter(
      (filter) => filter.id === 'all' || availableIds.has(filter.id),
    ),
    proofItems: input.content.proofItems.map((item) => ({
      id: item.id,
      icon: MODEL_EXAMPLE_ICON_BY_ID[item.icon],
      title: item.title,
      body: item.body,
    })),
    decision: {
      items,
      examplesLinkHref: input.mode === 'image-fallback' && !galleryItems.length
        ? null
        : input.examplesLinkHref,
      viewAllLabel: input.ui.viewAllLabel,
      renderLinkLabel: input.mode === 'image-fallback' ? input.ui.openLabel : input.ui.renderLabel,
      emptyLabel: formatEmptyExamplesLabel(input.ui, input.modelName),
      noPreviewLabel: input.ui.noPreviewLabel,
    },
    defaultPresentation: {
      items: buildDefaultItems(input),
      examplesLinkHref: input.examplesLinkHref,
      renderLinkLabel: input.ui.renderLabel,
      noPreviewLabel: input.ui.noPreviewLabel,
    },
  };
}
