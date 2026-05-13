import Image from 'next/image';
import {
  AudioLines,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  Type,
  Users,
  Zap,
  PenLine,
  Maximize2,
  type LucideIcon,
} from 'lucide-react';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { ButtonLink } from '@/components/ui/Button';
import { TextLink } from '@/components/ui/TextLink';
import { UIIcon } from '@/components/ui/UIIcon';
import { deriveShortPromptLabel, getImageAlt, inferRenderTag } from '@/lib/image-alt';
import { MODEL_PAGE_ICON, MODEL_PAGE_ICON_WRAP } from '../_lib/model-page-icon-styles';
import { PRICE_AUDIO_LABELS } from '../_lib/model-page-specs-constants';
import {
  FULL_BLEED_CONTENT,
  FULL_BLEED_SECTION,
  SECTION_BG_A,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
  type SoraCopy,
} from '../_lib/model-page-specs';
import {
  ModelDecisionExamplesGallery,
  type DecisionExampleFilter,
  type DecisionExampleFilterId,
  type DecisionExampleGalleryItem,
} from './ModelDecisionExamplesGallery.client';

type ModelExamplesSectionProps = {
  hideExamplesSection: boolean;
  textAnchorId: string;
  copy: SoraCopy;
  galleryVideos: ExampleGalleryVideo[];
  galleryPreviewAlts: Map<string, string>;
  engineSlug: string;
  fallbackImageUrl: string | null;
  isImageEngine: boolean;
  locale: AppLocale;
  examplesLinkHref: LocalizedLinkHref;
  galleryCtaHref: LocalizedLinkHref;
  variant?: 'default' | 'decision';
};

function getExampleMetadata(video: ExampleGalleryVideo, locale: AppLocale) {
  const duration = locale === 'es' || locale === 'fr' ? `${video.durationSec} s` : `${video.durationSec}s`;
  const audioLabels = PRICE_AUDIO_LABELS[locale] ?? PRICE_AUDIO_LABELS.en;
  const audio = video.hasAudio ? audioLabels.on.toLowerCase() : audioLabels.off.toLowerCase();
  return [video.aspectRatio ?? 'Auto', duration, audio].join(' · ');
}

function getRenderLinkLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Voir le rendu';
  if (locale === 'es') return 'Ver resultado';
  return 'View render';
}

function getViewAllExamplesLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Voir tous les exemples';
  if (locale === 'es') return 'Ver todos los ejemplos';
  return 'View all examples';
}

function resolveExamplesModelName(copy: SoraCopy) {
  const rawTitle = copy.heroTitle ?? copy.galleryTitle ?? '';
  const cleanedTitle = rawTitle
    .replace(/\s+(?:examples|exemples|ejemplos)\b.*$/i, '')
    .replace(/\s+-\s+.*$/i, '')
    .trim();
  return cleanedTitle || 'this model';
}

function getNoExamplesForFilterLabel(locale: AppLocale, modelName: string) {
  if (locale === 'fr') return `Aucun exemple ${modelName} ne correspond encore à ce filtre.`;
  if (locale === 'es') return `Todavía no hay ejemplos de ${modelName} para este filtro.`;
  return `No ${modelName} examples match this filter yet.`;
}

function getFallbackExamplesTitle(locale: AppLocale, modelName: string) {
  if (locale === 'fr') return `Exemples ${modelName}`;
  if (locale === 'es') return `Ejemplos de ${modelName}`;
  return `${modelName} examples`;
}

function getFallbackExamplesIntro(locale: AppLocale, modelName: string) {
  if (locale === 'fr') {
    return `Explorez des rendus de la communauté et voyez comment ${modelName} se comporte dans des workflows MaxVideoAI.`;
  }
  if (locale === 'es') {
    return `Explora resultados de la comunidad y mira cómo ${modelName} funciona en flujos de MaxVideoAI.`;
  }
  return `Explore real community outputs and see how ${modelName} performs inside MaxVideoAI workflows.`;
}

function getDecisionExampleFilters(locale: AppLocale, isImageEngine: boolean, engineSlug?: string): DecisionExampleFilter[] {
  if (isImageEngine) {
    if (engineSlug === 'nano-banana-2') {
      if (locale === 'fr') {
        return [
          { id: 'all', label: 'Tous' },
          { id: 'grounded', label: 'Guidé' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'Références' },
          { id: 'wide', label: 'Ratio large' },
        ];
      }
      if (locale === 'es') {
        return [
          { id: 'all', label: 'Todo' },
          { id: 'grounded', label: 'Guiado' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'Referencias' },
          { id: 'wide', label: 'Ratio amplio' },
        ];
      }
      return [
        { id: 'all', label: 'All' },
        { id: 'grounded', label: 'Grounded' },
        { id: 'edit', label: 'Edit' },
        { id: 'reference', label: 'References' },
        { id: 'wide', label: 'Wide ratio' },
      ];
    }
    if (locale === 'fr') {
      return [
        { id: 'all', label: 'Tous' },
        { id: 'campaign', label: 'Campagne' },
        { id: 'typography', label: 'Typographie' },
        { id: 'reference', label: 'Référence' },
        { id: 'final', label: '4K final' },
      ];
    }
    if (locale === 'es') {
      return [
        { id: 'all', label: 'Todo' },
        { id: 'campaign', label: 'Campaña' },
        { id: 'typography', label: 'Tipografía' },
        { id: 'reference', label: 'Referencia' },
        { id: 'final', label: '4K final' },
      ];
    }
    return [
      { id: 'all', label: 'All' },
      { id: 'campaign', label: 'Campaign' },
      { id: 'typography', label: 'Typography' },
      { id: 'reference', label: 'Reference edit' },
      { id: 'final', label: '4K final' },
    ];
  }

  if (locale === 'fr') {
    return [
      { id: 'all', label: 'Tous' },
      { id: 'cinematic', label: 'Cinématique' },
      { id: 'product', label: 'Produit / Pub' },
      { id: 'action', label: 'Action' },
      { id: 'vertical', label: 'Vertical' },
      { id: 'audio', label: PRICE_AUDIO_LABELS.fr.on },
    ];
  }
  if (locale === 'es') {
    return [
      { id: 'all', label: 'Todo' },
      { id: 'cinematic', label: 'Cinemático' },
      { id: 'product', label: 'Producto / Anuncio' },
      { id: 'action', label: 'Acción' },
      { id: 'vertical', label: 'Vertical' },
      { id: 'audio', label: PRICE_AUDIO_LABELS.es.on },
    ];
  }
  return [
    { id: 'all', label: 'All' },
    { id: 'cinematic', label: 'Cinematic' },
    { id: 'product', label: 'Product / Ad' },
    { id: 'action', label: 'Action' },
    { id: 'vertical', label: 'Vertical' },
    { id: 'audio', label: 'Audio on' },
  ];
}

function getDecisionExampleProofItems(locale: AppLocale, modelName: string, isImageEngine: boolean): Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  tone: string;
}> {
  if (isImageEngine) {
    if (locale === 'fr') {
      return [
        { title: 'Exemples image', body: `Prompts stills adaptés à ${modelName}.`, icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Typographie', body: 'Texte exact, hiérarchie et placement restent visibles.', icon: Type, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Retouches référence', body: 'Gardez produit, identité, palette ou layout.', icon: PenLine, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Finales 4K', body: 'Validez en 2K puis finalisez en 4K.', icon: Maximize2, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Prêt production', body: 'Références possédées et garde-fous intégrés.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
      ];
    }
    if (locale === 'es') {
      return [
        { title: 'Ejemplos de imagen', body: `Prompts still adaptados a ${modelName}.`, icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Tipografía', body: 'Texto exacto, jerarquía y ubicación legibles.', icon: Type, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Ediciones con referencia', body: 'Mantén producto, identidad, paleta o layout.', icon: PenLine, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Finales 4K', body: 'Valida en 2K y termina en 4K.', icon: Maximize2, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Listo para producción', body: 'Referencias propias y controles integrados.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
      ];
    }
    return [
      { title: 'Still image examples', body: `Prompt patterns tailored to ${modelName}.`, icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Typography control', body: 'Exact copy, hierarchy and placement stay explicit.', icon: Type, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Reference edits', body: 'Keep product identity, palette, layout or style.', icon: PenLine, tone: MODEL_PAGE_ICON_WRAP },
      { title: '4K finals', body: 'Validate at 2K, then finish at 4K.', icon: Maximize2, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Safe for production', body: 'Owned references and built-in guardrails.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
    ];
  }

  if (locale === 'fr') {
    return [
      { title: 'Rendus communautaires', body: `Voyez ce qui est possible avec ${modelName}.`, icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Recréer un plan', body: 'Ouvrez l’app en un clic et réutilisez la configuration.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Audio natif', body: 'Dialogue, ambiance et SFX générés en synchro.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Continuité multi-plans', body: 'Gardez personnages, style et scène cohérents.', icon: Users, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Prêt pour la production', body: 'Garde-fous et filtres intégrés.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
    ];
  }

  if (locale === 'es') {
    return [
      { title: 'Resultados reales', body: `Mira qué es posible con ${modelName}.`, icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Recrear una toma', body: 'Abre la app con un clic y reutiliza la configuración.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Audio nativo', body: 'Diálogo, ambiente y efectos de sonido generados en sincronía.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Continuidad entre tomas', body: 'Mantiene personajes, estilo y escena consistentes.', icon: Users, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Listo para producción', body: 'Controles de seguridad y filtros integrados.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
    ];
  }

  return [
    { title: 'Real community renders', body: `See what's possible with ${modelName}.`, icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
    { title: 'Recreate any shot', body: 'Jump into the app with one click and reuse the setup.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
    { title: 'Native audio', body: 'Dialogue, ambience and SFX generated in sync.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
    { title: 'Multi-shot continuity', body: 'Keep characters, style and scene consistency across sequences.', icon: Users, tone: MODEL_PAGE_ICON_WRAP },
    { title: 'Safe for production', body: 'Built-in guardrails and safety filters for peace of mind.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
  ];
}

function getDecisionExampleCategory(video: ExampleGalleryVideo, locale: AppLocale) {
  const tag = inferRenderTag(video.promptFull ?? video.prompt, locale);
  if (tag) return tag;
  if (video.hasAudio) return locale === 'fr' ? 'Cinématique' : locale === 'es' ? 'Cinemático' : 'Cinematic';
  return locale === 'fr' ? 'Render' : locale === 'es' ? 'Render' : 'Render';
}

function getCuratedDecisionExampleTitle(index: number, fallback: string, locale: AppLocale, useCuratedLabels: boolean) {
  if (!useCuratedLabels) return fallback;
  const labels: Record<AppLocale, string[]> = {
    en: ['Parkour rooftop run', 'Trading desk intensity', 'Clothing try-on moment', 'Narrative reunion'],
    fr: ['Parkour sur toit', 'Intensité en salle de trading', 'Essayage de vêtement', 'Retrouvailles narratives'],
    es: ['Parkour en azotea', 'Intensidad mesa de trading', 'Prueba de ropa', 'Reencuentro narrativo'],
  };
  return labels[locale]?.[index] ?? fallback;
}

function getCuratedDecisionExampleCategory(index: number, fallback: string, locale: AppLocale, useCuratedLabels: boolean) {
  if (!useCuratedLabels) return fallback;
  const labels: Record<AppLocale, string[]> = {
    en: ['Cinematic · Action', 'Corporate · Tech', 'Lifestyle · Product', 'Narrative · Romance'],
    fr: ['Cinématique · Action', 'Corporate · Tech', 'Lifestyle · Produit', 'Narratif · Romance'],
    es: ['Cinemático · Acción', 'Corporativo · Tech', 'Lifestyle · Producto', 'Narrativa · Romance'],
  };
  return labels[locale]?.[index] ?? fallback;
}

function getDisplayAspectRatio(video: ExampleGalleryVideo) {
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

function getDurationLabel(video: ExampleGalleryVideo, locale: AppLocale) {
  return locale === 'es' || locale === 'fr' ? `${video.durationSec} s` : `${video.durationSec}s`;
}

function getAudioBadgeLabel(video: ExampleGalleryVideo, locale: AppLocale) {
  const labels = PRICE_AUDIO_LABELS[locale] ?? PRICE_AUDIO_LABELS.en;
  return video.hasAudio ? labels.on : labels.off;
}

function getDecisionExampleTags(
  video: ExampleGalleryVideo,
  category: string,
  aspectRatio: string | null,
  isImageEngine: boolean
): DecisionExampleFilterId[] {
  const categoryText = category.toLowerCase();
  const titleText = deriveShortPromptLabel(video.promptFull ?? video.prompt, 'en').toLowerCase();
  const tags = new Set<DecisionExampleFilterId>();
  if (isImageEngine) {
    if (/\b(campaign|campagne|campaña|ad|poster|launch)\b/.test(`${categoryText} ${titleText}`)) tags.add('campaign');
    if (/\b(type|typography|typographie|tipograf)\b/.test(`${categoryText} ${titleText}`)) tags.add('typography');
    if (/\b(reference|référence|referencia|edit|retouche|edici)/.test(`${categoryText} ${titleText}`)) tags.add('reference');
    if (/\b(4k|final)\b/.test(`${categoryText} ${titleText}`)) tags.add('final');
    return Array.from(tags);
  }
  if (video.hasAudio) tags.add('audio');
  if (aspectRatio === '9:16') tags.add('vertical');
  if (/\b(action|parkour|run|running|chase|combat|sport)\b/.test(`${categoryText} ${titleText}`)) {
    tags.add('action');
  }
  if (/\b(product|produit|producto|ad|pub|anuncio|lifestyle|clothing|try-on|brand|branded)\b/.test(categoryText)) {
    tags.add('product');
  }
  if (/\b(cinematic|cinematique|cinématique|cinematico|cinemático|narrative|narratif|narrativa|romance|film|filmique)\b/.test(categoryText)) {
    tags.add('cinematic');
  }
  return Array.from(tags);
}

function buildDecisionExampleItems({
  galleryVideos,
  galleryPreviewAlts,
  locale,
  copy,
  isImageEngine,
}: {
  galleryVideos: ExampleGalleryVideo[];
  galleryPreviewAlts: Map<string, string>;
  locale: AppLocale;
  copy: SoraCopy;
  isImageEngine: boolean;
}): DecisionExampleGalleryItem[] {
  const modelName = resolveExamplesModelName(copy);
  const useCuratedLabels = /seedance/i.test(modelName);

  return galleryVideos.slice(0, 4).map((video, index) => {
    const fallbackTitle = deriveShortPromptLabel(video.promptFull ?? video.prompt, locale);
    const shortTitle = getCuratedDecisionExampleTitle(index, fallbackTitle, locale, useCuratedLabels);
    const category = getCuratedDecisionExampleCategory(index, getDecisionExampleCategory(video, locale), locale, useCuratedLabels);
    const aspectRatio = getDisplayAspectRatio(video);
    const posterUrl = video.optimizedPosterUrl ?? video.rawPosterUrl ?? '';
    return {
      id: video.id,
      href: video.href,
      posterUrl,
      alt: galleryPreviewAlts.get(video.id) ?? `${video.engineLabel} example: ${shortTitle}`,
      audioBadgeLabel: isImageEngine ? null : getAudioBadgeLabel(video, locale),
      durationLabel: isImageEngine ? null : getDurationLabel(video, locale),
      aspectRatio,
      category,
      title: shortTitle,
      recreateHref: video.recreateHref ?? null,
      recreateLabel: copy.recreateLabel ?? null,
      tags: getDecisionExampleTags(video, category, aspectRatio, isImageEngine),
    };
  });
}

function buildImageFallbackExampleItems({
  copy,
  engineSlug,
  fallbackImageUrl,
  locale,
}: {
  copy: SoraCopy;
  engineSlug: string;
  fallbackImageUrl: string | null;
  locale: AppLocale;
}): DecisionExampleGalleryItem[] {
  const appHref = `/app/image?engine=${encodeURIComponent(engineSlug)}`;
  const recreateLabel =
    copy.recreateLabel ??
    (locale === 'fr' ? 'Recréer ce still →' : locale === 'es' ? 'Recrear este still →' : 'Recreate this still →');
  const isNanoBanana2 = engineSlug === 'nano-banana-2';
  const examples = isNanoBanana2
    ? locale === 'fr'
      ? [
          ['grounded', 'Scène produit guidée', 'Guidé · 1K', '1K', 'Image Nano Banana 2 guidée par contexte pour un lancement produit'],
          ['edit', 'Edit produit contrôlé', 'Edit', 'Edit', 'Retouche produit Nano Banana 2 avec contraintes de conservation'],
          ['reference', 'Edit multi-références', 'Références', 'Refs', 'Image Nano Banana 2 assemblant plusieurs références produit'],
          ['wide', 'Still large 4K', 'Ratio large', '4K · 21:9', 'Still Nano Banana 2 en format large 4K'],
        ]
      : locale === 'es'
        ? [
            ['grounded', 'Escena de producto guiada', 'Guiado · 1K', '1K', 'Imagen Nano Banana 2 guiada por contexto para lanzamiento de producto'],
            ['edit', 'Edit controlado de producto', 'Edit', 'Edit', 'Edición de producto Nano Banana 2 con restricciones claras'],
            ['reference', 'Edit multi-referencia', 'Referencias', 'Refs', 'Imagen Nano Banana 2 que combina varias referencias de producto'],
            ['wide', 'Still amplio 4K', 'Ratio amplio', '4K · 21:9', 'Still Nano Banana 2 en formato amplio 4K'],
          ]
        : [
            ['grounded', 'Grounded product scene', 'Grounded · 1K', '1K', 'Nano Banana 2 grounded product launch image'],
            ['edit', 'Controlled product edit', 'Edit', 'Edit', 'Nano Banana 2 product edit with keep-and-change constraints'],
            ['reference', 'Multi-reference edit', 'References', 'Refs', 'Nano Banana 2 image combining multiple product references'],
            ['wide', 'Wide-ratio 4K still', 'Wide ratio', '4K · 21:9', 'Nano Banana 2 wide 4K still image'],
          ]
    : locale === 'fr'
      ? [
          ['campaign', 'Visuel campagne 2K', 'Campagne', '2K', 'Image campagne Nano Banana Pro avec layout publicitaire'],
          ['typography', 'Poster typographique', 'Typographie', '4K', 'Poster Nano Banana Pro avec typographie lisible'],
          ['reference', 'Retouche référence', 'Référence', 'Edit', 'Retouche produit Nano Banana Pro guidée par référence'],
          ['final', 'Final 2K vers 4K', 'Final 4K', '4K', 'Asset campagne Nano Banana Pro finalisé en 4K'],
        ]
      : locale === 'es'
        ? [
            ['campaign', 'Still de campaña 2K', 'Campaña', '2K', 'Imagen de campaña Nano Banana Pro con layout publicitario'],
            ['typography', 'Póster tipográfico', 'Tipografía', '4K', 'Póster Nano Banana Pro con tipografía legible'],
            ['reference', 'Edición con referencia', 'Referencia', 'Edit', 'Edición de producto Nano Banana Pro guiada por referencia'],
            ['final', 'Final 2K a 4K', 'Final 4K', '4K', 'Asset de campaña Nano Banana Pro finalizado en 4K'],
          ]
        : [
            ['campaign', '2K campaign still', 'Campaign', '2K', 'Nano Banana Pro campaign image with ad layout'],
            ['typography', 'Typography poster', 'Typography', '4K', 'Nano Banana Pro poster with readable typography'],
            ['reference', 'Reference edit', 'Reference edit', 'Edit', 'Nano Banana Pro product edit guided by references'],
            ['final', '2K to 4K final', '4K final', '4K', 'Nano Banana Pro campaign asset finalized in 4K'],
          ];

  return examples.map(([tag, title, category, resolution, alt]) => ({
    id: `${engineSlug}-fallback-${tag}`,
    href: appHref,
    posterUrl: fallbackImageUrl ?? '',
    alt,
    audioBadgeLabel: null,
    durationLabel: null,
    aspectRatio: resolution,
    category,
    title,
    recreateHref: appHref,
    recreateLabel,
    tags: [tag as DecisionExampleFilterId],
  }));
}

function getAvailableDecisionExampleFilters(locale: AppLocale, items: DecisionExampleGalleryItem[], isImageEngine: boolean, engineSlug?: string) {
  const filters = getDecisionExampleFilters(locale, isImageEngine, engineSlug);
  const availableIds = new Set(items.flatMap((item) => item.tags));
  return filters.filter((filter) => filter.id === 'all' || availableIds.has(filter.id));
}

function ModelDecisionExamplesPanel({
  textAnchorId,
  copy,
  galleryVideos,
  galleryPreviewAlts,
  engineSlug,
  fallbackImageUrl,
  isImageEngine,
  locale,
  examplesLinkHref,
}: Omit<ModelExamplesSectionProps, 'hideExamplesSection' | 'galleryCtaHref' | 'variant'>) {
  const renderLinkLabel = isImageEngine
    ? locale === 'fr'
      ? 'Ouvrir'
      : locale === 'es'
        ? 'Abrir'
        : 'Open'
    : getRenderLinkLabel(locale);
  const modelName = resolveExamplesModelName(copy);
  const proofItems = getDecisionExampleProofItems(locale, modelName, isImageEngine);
  const title = copy.galleryTitle ?? getFallbackExamplesTitle(locale, modelName);
  const intro = copy.galleryIntro ?? getFallbackExamplesIntro(locale, modelName);
  const galleryItems = buildDecisionExampleItems({ galleryVideos, galleryPreviewAlts, locale, copy, isImageEngine });
  const fallbackItems = isImageEngine
    ? buildImageFallbackExampleItems({ copy, engineSlug, fallbackImageUrl, locale })
    : [];
  const items = isImageEngine && engineSlug === 'nano-banana-2' ? fallbackItems : galleryItems.length ? galleryItems : fallbackItems;
  const filters = getAvailableDecisionExampleFilters(locale, items, isImageEngine, engineSlug);

  return (
    <section id={textAnchorId} className={SECTION_SCROLL_MARGIN}>
      <div className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:bg-slate-950/72 dark:shadow-[0_24px_70px_-42px_rgba(0,0,0,0.85)] sm:p-7">
        <ModelDecisionExamplesGallery
          title={title}
          intro={intro}
          filters={filters}
          items={items}
          examplesLinkHref={examplesLinkHref}
          viewAllLabel={getViewAllExamplesLabel(locale)}
          renderLinkLabel={renderLinkLabel}
          emptyLabel={getNoExamplesForFilterLabel(locale, modelName)}
        />

        <div className="mt-4 grid grid-cols-2 rounded-xl border border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.035] lg:grid-cols-5">
          {proofItems.map((item, index) => (
            <div
              key={item.title}
              className={[
                'flex gap-2.5 p-3 sm:gap-3 sm:p-4',
                index % 2 === 1 ? 'border-l border-slate-200 dark:border-white/10' : '',
                index >= 2 ? 'border-t border-slate-200 dark:border-white/10 lg:border-t-0' : '',
                index > 0 ? 'lg:border-l lg:border-slate-200 dark:lg:border-white/10' : '',
              ].join(' ')}
            >
              <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${item.tone}`}>
                <UIIcon icon={item.icon} size={19} strokeWidth={1.85} className={MODEL_PAGE_ICON} />
              </span>
              <div>
                <h3 className="!text-left text-[0.82rem] font-semibold leading-snug text-slate-950 dark:text-white sm:text-sm">{item.title}</h3>
                <p className="mt-1 text-[0.74rem] leading-4 text-slate-600 dark:text-slate-300 sm:text-[0.8rem] sm:leading-5">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ModelExamplesSection({
  hideExamplesSection,
  textAnchorId,
  copy,
  galleryVideos,
  galleryPreviewAlts,
  engineSlug,
  fallbackImageUrl,
  isImageEngine,
  locale,
  examplesLinkHref,
  galleryCtaHref,
  variant = 'default',
}: ModelExamplesSectionProps) {
  const hasFallbackGalleryCopy = Boolean(
    copy.galleryTitle || copy.galleryIntro || copy.galleryAllCta || copy.gallerySceneCta
  );

  if (hideExamplesSection || (!galleryVideos.length && !hasFallbackGalleryCopy && !isImageEngine)) {
    return null;
  }

  const renderLinkLabel = getRenderLinkLabel(locale);

  if (variant === 'decision') {
    return (
      <ModelDecisionExamplesPanel
        textAnchorId={textAnchorId}
        copy={copy}
        galleryVideos={galleryVideos}
        galleryPreviewAlts={galleryPreviewAlts}
        engineSlug={engineSlug}
        fallbackImageUrl={fallbackImageUrl}
        isImageEngine={isImageEngine}
        locale={locale}
        examplesLinkHref={examplesLinkHref}
      />
    );
  }

  return (
    <section id={textAnchorId} className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN}`}>
      <div className={`${FULL_BLEED_CONTENT} px-6 sm:px-8`}>
        {copy.galleryTitle ? (
          <h2 className="mt-0 text-center text-2xl font-semibold text-text-primary sm:mt-0 sm:text-3xl">
            {copy.galleryTitle}
          </h2>
        ) : null}
        {galleryVideos.length ? (
          <>
            {copy.galleryIntro ? (
              <p className="mt-2 text-center text-base leading-relaxed text-text-secondary">{copy.galleryIntro}</p>
            ) : null}
            <div className="mt-4 stack-gap">
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-full gap-4">
                  {galleryVideos.slice(0, 6).map((video) => (
                    <article
                      key={video.id}
                      className="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card"
                    >
                      <Link href={video.href} className="group relative block aspect-video bg-placeholder">
                        {video.optimizedPosterUrl || video.rawPosterUrl ? (
                          <Image
                            src={video.optimizedPosterUrl ?? video.rawPosterUrl ?? ''}
                            alt={
                              galleryPreviewAlts.get(video.id) ??
                              getImageAlt({
                                kind: 'renderThumb',
                                engine: video.engineLabel,
                                label: video.prompt,
                                prompt: video.prompt,
                                locale,
                              })
                            }
                            fill
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                            sizes="320px"
                            quality={70}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-skeleton text-xs font-semibold text-text-muted">
                            No preview
                          </div>
                        )}
                      </Link>
                      <div className="space-y-1 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                          {getExampleMetadata(video, locale)}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <TextLink href={video.href} className="text-[11px]" linkComponent={Link}>
                            {renderLinkLabel}
                          </TextLink>
                          {video.recreateHref && copy.recreateLabel ? (
                            <TextLink href={video.recreateHref} className="text-[11px]" linkComponent={Link}>
                              {copy.recreateLabel}
                            </TextLink>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
            {copy.galleryAllCta ? (
              <p className="mt-4 text-center text-base leading-relaxed text-text-secondary">
                <Link href={examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                  {copy.galleryAllCta}
                </Link>
              </p>
            ) : null}
          </>
        ) : copy.galleryIntro || copy.galleryAllCta ? (
          <div className="mt-4 rounded-2xl border border-dashed border-hairline bg-surface/60 px-4 py-4 text-sm text-text-secondary">
            {copy.galleryIntro}{' '}
            {copy.galleryAllCta ? (
              <Link href={examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                {copy.galleryAllCta}
              </Link>
            ) : null}
          </div>
        ) : null}
        {copy.gallerySceneCta ? (
          <div className="mt-6">
            <ButtonLink href={galleryCtaHref} size="lg" className="shadow-card" linkComponent={Link}>
              {copy.gallerySceneCta}
            </ButtonLink>
          </div>
        ) : null}
      </div>
    </section>
  );
}
