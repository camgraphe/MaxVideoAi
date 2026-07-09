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

function isLumaRay2Route(engineSlug?: string) {
  return engineSlug === 'luma-ray-2' || engineSlug === 'lumaRay2';
}

function isLumaRay2FlashRoute(engineSlug?: string) {
  return engineSlug === 'luma-ray-2-flash' || engineSlug === 'lumaRay2_flash';
}

function isLumaRay32Route(engineSlug?: string) {
  return engineSlug === 'luma-ray-3-2';
}

function isLumaUni1Route(engineSlug?: string) {
  return engineSlug === 'luma-uni-1';
}

function isLumaUni1MaxRoute(engineSlug?: string) {
  return engineSlug === 'luma-uni-1-max';
}

function isVeoLiteRoute(engineSlug?: string) {
  return engineSlug === 'veo-3-1-lite';
}

function isVeoFastRoute(engineSlug?: string) {
  return engineSlug === 'veo-3-1-fast';
}

function isVeo31Route(engineSlug?: string) {
  return engineSlug === 'veo-3-1';
}

function isSeedance20FastRoute(engineSlug?: string) {
  return engineSlug === 'seedance-2-0-fast';
}

function isSeedance15ProRoute(engineSlug?: string) {
  return engineSlug === 'seedance-1-5-pro';
}

function isSora2ProRoute(engineSlug?: string) {
  return engineSlug === 'sora-2-pro';
}

function isSora2Route(engineSlug?: string) {
  return engineSlug === 'sora-2';
}

function isLtx23FastRoute(engineSlug?: string) {
  return engineSlug === 'ltx-2-3-fast';
}

function isLtx23ProRoute(engineSlug?: string) {
  return engineSlug === 'ltx-2-3-pro' || engineSlug === 'ltx-2-3';
}

function isKling34kRoute(engineSlug?: string) {
  return engineSlug === 'kling-3-4k';
}

function isKling3ProRoute(engineSlug?: string) {
  return engineSlug === 'kling-3-pro';
}

function isKling3StandardRoute(engineSlug?: string) {
  return engineSlug === 'kling-3-standard';
}

function isSilentVideoDecisionEngine(engineSlug?: string) {
  return (
    engineSlug === 'minimax-hailuo-02-text' ||
    engineSlug === 'pika-text-to-video' ||
    isLumaRay2Route(engineSlug) ||
    isLumaRay2FlashRoute(engineSlug) ||
    isLumaRay32Route(engineSlug)
  );
}

function getDecisionExampleFilters(locale: AppLocale, isImageEngine: boolean, engineSlug?: string): DecisionExampleFilter[] {
  if (isImageEngine) {
    if (engineSlug === 'nano-banana-lite') {
      if (locale === 'fr') {
        return [
          { id: 'all', label: 'Tous' },
          { id: 'campaign', label: 'Drafts 1K' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'Références' },
          { id: 'batch', label: 'Variantes' },
        ];
      }
      if (locale === 'es') {
        return [
          { id: 'all', label: 'Todo' },
          { id: 'campaign', label: 'Drafts 1K' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'Referencias' },
          { id: 'batch', label: 'Variantes' },
        ];
      }
      return [
        { id: 'all', label: 'All' },
        { id: 'campaign', label: '1K drafts' },
        { id: 'edit', label: 'Edit' },
        { id: 'reference', label: 'References' },
        { id: 'batch', label: 'Variants' },
      ];
    }

    if (engineSlug === 'seedream-5-0-pro') {
      if (locale === 'fr') {
        return [
          { id: 'all', label: 'Tous' },
          { id: 'infographic', label: 'Infographie' },
          { id: 'campaign', label: 'Campagne' },
          { id: 'edit', label: 'Edit' },
          { id: 'final', label: 'Frame final' },
        ];
      }
      if (locale === 'es') {
        return [
          { id: 'all', label: 'Todo' },
          { id: 'infographic', label: 'Infografia' },
          { id: 'campaign', label: 'Campaña' },
          { id: 'edit', label: 'Edit' },
          { id: 'final', label: 'Frame final' },
        ];
      }
      return [
        { id: 'all', label: 'All' },
        { id: 'infographic', label: 'Infographic' },
        { id: 'campaign', label: 'Campaign' },
        { id: 'edit', label: 'Edit' },
        { id: 'final', label: 'Final frame' },
      ];
    }

    if (engineSlug === 'seedream') {
      if (locale === 'fr') {
        return [
          { id: 'all', label: 'Tous' },
          { id: 'product', label: 'Produit' },
          { id: 'character', label: 'Personnage' },
          { id: 'edit', label: 'Edit' },
          { id: 'batch', label: 'Batch' },
        ];
      }
      if (locale === 'es') {
        return [
          { id: 'all', label: 'Todo' },
          { id: 'product', label: 'Producto' },
          { id: 'character', label: 'Personaje' },
          { id: 'edit', label: 'Edit' },
          { id: 'batch', label: 'Batch' },
        ];
      }
      return [
        { id: 'all', label: 'All' },
        { id: 'product', label: 'Product still' },
        { id: 'character', label: 'Character' },
        { id: 'edit', label: 'Edit' },
        { id: 'batch', label: 'Batch' },
      ];
    }

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
    if (engineSlug === 'gpt-image-2') {
      if (locale === 'fr') {
        return [
          { id: 'all', label: 'Tous' },
          { id: 'product', label: 'Produit' },
          { id: 'typography', label: 'Texte' },
          { id: 'ui', label: 'UI' },
          { id: 'edit', label: 'Edit' },
          { id: 'mask', label: 'Masque' },
          { id: 'final', label: '4K final' },
        ];
      }
      if (locale === 'es') {
        return [
          { id: 'all', label: 'Todo' },
          { id: 'product', label: 'Producto' },
          { id: 'typography', label: 'Texto' },
          { id: 'ui', label: 'UI' },
          { id: 'edit', label: 'Edit' },
          { id: 'mask', label: 'Máscara' },
          { id: 'final', label: '4K final' },
        ];
      }
      return [
        { id: 'all', label: 'All' },
        { id: 'product', label: 'Product' },
        { id: 'typography', label: 'Readable text' },
        { id: 'ui', label: 'UI mockup' },
        { id: 'edit', label: 'Image edit' },
        { id: 'mask', label: 'Mask edit' },
        { id: 'final', label: '4K final' },
      ];
    }
    if (isLumaUni1Route(engineSlug)) {
      if (locale === 'fr') {
        return [
          { id: 'all', label: 'Tous' },
          { id: 'product', label: 'Produit' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'References' },
          { id: 'campaign', label: 'Direction' },
        ];
      }
      if (locale === 'es') {
        return [
          { id: 'all', label: 'Todo' },
          { id: 'product', label: 'Producto' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'Referencias' },
          { id: 'campaign', label: 'Direccion' },
        ];
      }
      return [
        { id: 'all', label: 'All' },
        { id: 'product', label: 'Product' },
        { id: 'edit', label: 'Edit' },
        { id: 'reference', label: 'References' },
        { id: 'campaign', label: 'Direction' },
      ];
    }
    if (isLumaUni1MaxRoute(engineSlug)) {
      if (locale === 'fr') {
        return [
          { id: 'all', label: 'Tous' },
          { id: 'product', label: 'Produit' },
          { id: 'typography', label: 'Typographie' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'References' },
        ];
      }
      if (locale === 'es') {
        return [
          { id: 'all', label: 'Todo' },
          { id: 'product', label: 'Producto' },
          { id: 'typography', label: 'Tipografia' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'Referencias' },
        ];
      }
      return [
        { id: 'all', label: 'All' },
        { id: 'product', label: 'Product' },
        { id: 'typography', label: 'Typography' },
        { id: 'edit', label: 'Edit' },
        { id: 'reference', label: 'References' },
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
    const filters: DecisionExampleFilter[] = [
      { id: 'all', label: 'Tous' },
      { id: 'cinematic', label: 'Cinématique' },
      { id: 'product', label: 'Produit / Pub' },
      { id: 'action', label: 'Action' },
      { id: 'vertical', label: 'Vertical' },
    ];
    if (!isSilentVideoDecisionEngine(engineSlug)) filters.push({ id: 'audio', label: PRICE_AUDIO_LABELS.fr.on });
    return filters;
  }
  if (locale === 'es') {
    const filters: DecisionExampleFilter[] = [
      { id: 'all', label: 'Todo' },
      { id: 'cinematic', label: 'Cinemático' },
      { id: 'product', label: 'Producto / Anuncio' },
      { id: 'action', label: 'Acción' },
      { id: 'vertical', label: 'Vertical' },
    ];
    if (!isSilentVideoDecisionEngine(engineSlug)) filters.push({ id: 'audio', label: PRICE_AUDIO_LABELS.es.on });
    return filters;
  }
  const filters: DecisionExampleFilter[] = [
    { id: 'all', label: 'All' },
    { id: 'cinematic', label: 'Cinematic' },
    { id: 'product', label: 'Product / Ad' },
    { id: 'action', label: 'Action' },
    { id: 'vertical', label: 'Vertical' },
  ];
  if (!isSilentVideoDecisionEngine(engineSlug)) filters.push({ id: 'audio', label: 'Audio on' });
  return filters;
}

function getSilentBadgeLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Silencieux';
  if (locale === 'es') return 'Sin audio';
  return 'Silent';
}

function getDecisionExampleProofItems(locale: AppLocale, modelName: string, isImageEngine: boolean, engineSlug?: string): Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  tone: string;
}> {
  if (isImageEngine) {
    if (isLumaUni1Route(engineSlug) || isLumaUni1MaxRoute(engineSlug)) {
      const isMax = isLumaUni1MaxRoute(engineSlug);
      if (locale === 'fr') {
        return [
          { title: isMax ? 'Stills haute fidelite' : 'Stills propres', body: `${modelName} pour tester une direction image sans complexifier le prompt.`, icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
          { title: 'Edit guide', body: 'Modifiez une image source en gardant produit, forme et palette lisibles.', icon: PenLine, tone: MODEL_PAGE_ICON_WRAP },
          { title: 'References', body: 'Utilisez des images de depart ou de style quand la coherence compte.', icon: Users, tone: MODEL_PAGE_ICON_WRAP },
          { title: isMax ? 'Detail et texte' : 'Ratios simples', body: isMax ? 'Bon candidat pour posters, packshots et typographie courte.' : 'Validez produit, carre, vertical ou 16:9 avant de passer en video.', icon: isMax ? Type : Maximize2, tone: MODEL_PAGE_ICON_WRAP },
          { title: 'Pret video', body: 'Servez-vous des meilleurs stills comme images de depart pour Ray 3.2.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
        ];
      }
      if (locale === 'es') {
        return [
          { title: isMax ? 'Stills de alta fidelidad' : 'Stills limpios', body: `${modelName} para probar direccion visual sin hacer complejo el prompt.`, icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
          { title: 'Edit guiado', body: 'Edita una imagen fuente manteniendo producto, forma y paleta claros.', icon: PenLine, tone: MODEL_PAGE_ICON_WRAP },
          { title: 'Referencias', body: 'Usa imagenes iniciales o de estilo cuando la coherencia importa.', icon: Users, tone: MODEL_PAGE_ICON_WRAP },
          { title: isMax ? 'Detalle y texto' : 'Ratios simples', body: isMax ? 'Buen candidato para posters, packshots y tipografia corta.' : 'Valida producto, cuadrado, vertical o 16:9 antes de pasar a video.', icon: isMax ? Type : Maximize2, tone: MODEL_PAGE_ICON_WRAP },
          { title: 'Listo para video', body: 'Usa los mejores stills como imagen inicial para Ray 3.2.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
        ];
      }
      return [
        { title: isMax ? 'High-fidelity stills' : 'Clean stills', body: `${modelName} is best tested with a focused visual direction, not overloaded prompts.`, icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Guided edits', body: 'Edit a source image while keeping product shape, palette, and layout readable.', icon: PenLine, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'References', body: 'Use start or style references when consistency matters.', icon: Users, tone: MODEL_PAGE_ICON_WRAP },
        { title: isMax ? 'Detail and text' : 'Simple ratios', body: isMax ? 'Useful for posters, packshots, and short typography tests.' : 'Validate product, square, vertical, or 16:9 stills before video.', icon: isMax ? Type : Maximize2, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Video-ready', body: 'Use the strongest stills as start images for Ray 3.2.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
      ];
    }
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
      { title: 'Production-aware', body: 'Owned references and built-in guardrails.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
    ];
  }

  if (isSilentVideoDecisionEngine(engineSlug)) {
    const isPika = engineSlug === 'pika-text-to-video';
    const isLuma = isLumaRay2Route(engineSlug);
    const isLumaFlash = isLumaRay2FlashRoute(engineSlug);
    const isLuma32 = isLumaRay32Route(engineSlug);
    if (isLuma32) {
      if (locale === 'fr') {
        return [
          { title: 'Modify source', body: 'Etudiez comment Ray 3.2 change un clip sans perdre son timing.', icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
          { title: 'Reframe livraison', body: 'Recreez un ratio vertical, carre ou large depuis le meme master.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
          { title: 'Sortie silencieuse', body: 'Ray 3.2 ne genere pas d audio natif sur cette route MaxVideoAI.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
          { title: 'Images guides', body: 'Utilisez une image ou des images cles pour diriger des moments precis.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
          { title: 'Controle cout', body: 'Validez en 5 s / 540p ou 720p avant les passes 1080p.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
        ];
      }
      if (locale === 'es') {
        return [
          { title: 'Modify fuente', body: 'Estudia como Ray 3.2 cambia un clip sin perder su timing.', icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
          { title: 'Reframe entrega', body: 'Recrea un ratio vertical, cuadrado o ancho desde el mismo master.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
          { title: 'Salida sin audio', body: 'Ray 3.2 no genera audio nativo en esta ruta de MaxVideoAI.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
          { title: 'Cuadros guia', body: 'Usa un cuadro o imagenes clave para dirigir momentos concretos.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
          { title: 'Control de coste', body: 'Valida en 5 s / 540p o 720p antes de pasadas 1080p.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
        ];
      }
      return [
        { title: 'Modify source clips', body: 'Study how Ray 3.2 changes a clip without losing its timing.', icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Reframe delivery', body: 'Recreate a vertical, square, or wide cut from the same approved master.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Silent output', body: 'Ray 3.2 does not generate native audio on this MaxVideoAI route.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Guide frames', body: 'Use one frame or indexed keyframes to steer specific source moments.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Cost control', body: 'Validate at 5s / 540p or 720p before 1080p passes.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
      ];
    }
    if (locale === 'fr') {
      return [
        { title: isPika ? 'Boucles stylisées' : isLuma ? 'Rendus Luma premium' : isLumaFlash ? 'Brouillons Luma rapides' : 'Rendus brouillon', body: isPika ? 'Voyez les boucles Text-to-Video silencieuses possibles avec Pika 2.2.' : isLuma ? 'Comparez génération, image de départ, Modify et Reframe dans Ray 2.' : isLumaFlash ? 'Comparez vite directions, cadrages et versions Modify avant Ray 2.' : 'Voyez les tests mouvement légers possibles avec Hailuo 02.', icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
        { title: isLuma ? 'Recréer un rendu' : 'Recréer un test', body: isPika ? 'Ouvrez l’app et réutilisez le prompt, le ratio et la durée.' : isLuma ? 'Ouvrez l’app avec Ray 2 et réutilisez prompt, ratio et durée.' : isLumaFlash ? 'Ouvrez l’app avec Ray 2 Flash et réutilisez la recette du draft.' : 'Ouvrez l’app et réutilisez le prompt ou l’image de départ.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Sortie silencieuse', body: isPika ? 'Aucune bande-son générée ici ; ajoutez son et voix plus tard.' : isLuma ? 'Ray 2 ne génère pas d’audio natif dans cette route MaxVideoAI.' : isLumaFlash ? 'Ray 2 Flash ne génère pas d’audio natif dans cette route.' : 'Pas d’audio natif sur cette route ; ajoutez son et voix plus tard.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
        { title: isPika ? 'Seeds et négatifs' : isLuma || isLumaFlash ? 'Start image et edit' : 'Tests physiques', body: isPika ? 'Gardez une direction visuelle et bloquez texte, logos ou artefacts.' : isLuma ? 'Animez une image de départ, modifiez un clip source ou recadrez un master.' : isLumaFlash ? 'Animez une image de départ ou testez Modify/Reframe sur clip source.' : 'Vérifiez force, collisions, tissu, eau et contact au sol.', icon: Users, tone: MODEL_PAGE_ICON_WRAP },
        { title: isPika ? 'Social first' : isLuma ? 'Route finale Ray 2' : isLumaFlash ? 'Upgrade vers Ray 2' : 'Route de brouillon', body: isPika ? 'Pensé pour clips courts, overlays et loops à monter ensuite.' : isLuma ? 'Gardez Ray 2 pour les shots validés et les variantes de livraison.' : isLumaFlash ? 'Gardez Flash pour l’itération, puis finalisez les gagnants sur Ray 2.' : '512P/768P ici ; passez les plans validés sur une route finale.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
      ];
    }
    if (locale === 'es') {
      return [
        { title: isPika ? 'Loops estilizados' : isLuma ? 'Renders Luma premium' : isLumaFlash ? 'Borradores Luma rápidos' : 'Renders de borrador', body: isPika ? 'Mira loops Text-to-Video sin audio posibles con Pika 2.2.' : isLuma ? 'Compara generación, imagen inicial, Modify y Reframe dentro de Ray 2.' : isLumaFlash ? 'Compara rápido dirección, encuadre y versiones Modify antes de Ray 2.' : 'Mira pruebas ligeras de movimiento posibles con Hailuo 02.', icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
        { title: isLuma ? 'Recrear un render' : 'Recrear una prueba', body: isPika ? 'Abre la app y reutiliza prompt, formato y duración.' : isLuma ? 'Abre la app con Ray 2 y reutiliza prompt, formato y duración.' : isLumaFlash ? 'Abre la app con Ray 2 Flash y reutiliza la receta del borrador.' : 'Abre la app y reutiliza prompt o imagen inicial.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Salida sin audio', body: isPika ? 'Aquí no se genera banda sonora; añade sonido y voz después.' : isLuma ? 'Ray 2 no genera audio nativo en esta ruta de MaxVideoAI.' : isLumaFlash ? 'Ray 2 Flash no genera audio nativo en esta ruta.' : 'Esta ruta no tiene audio nativo; añade sonido y voz después.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
        { title: isPika ? 'Seeds y negativos' : isLuma || isLumaFlash ? 'Start image y edición' : 'Pruebas físicas', body: isPika ? 'Mantén una dirección visual y bloquea texto, logos o artefactos.' : isLuma ? 'Anima una imagen inicial, modifica un clip fuente o reencuadra un master.' : isLumaFlash ? 'Anima una imagen inicial o prueba Modify/Reframe sobre video fuente.' : 'Revisa fuerza, colisiones, tela, agua y contacto con el suelo.', icon: Users, tone: MODEL_PAGE_ICON_WRAP },
        { title: isPika ? 'Social first' : isLuma ? 'Ruta final Ray 2' : isLumaFlash ? 'Upgrade a Ray 2' : 'Ruta de borrador', body: isPika ? 'Pensado para clips cortos, overlays y loops para editar después.' : isLuma ? 'Usa Ray 2 para tomas aprobadas y variantes de entrega.' : isLumaFlash ? 'Usa Flash para iterar y finaliza los ganadores en Ray 2.' : '512P/768P aquí; pasa los planos aprobados a una ruta final.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
      ];
    }
    return [
      { title: isPika ? 'Stylized loops' : isLuma ? 'Premium Luma renders' : isLumaFlash ? 'Fast Luma drafts' : 'Draft renders', body: isPika ? `See silent Text-to-Video loops possible with ${modelName}.` : isLuma ? 'Compare generation, start-image motion, Modify and Reframe inside Ray 2.' : isLumaFlash ? 'Compare direction, framing and Modify variants before Ray 2.' : `See lightweight motion tests possible with ${modelName}.`, icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
      { title: isLuma ? 'Recreate a render' : 'Recreate a test', body: isPika ? 'Open the app and reuse the prompt, aspect ratio and duration.' : isLuma ? 'Open Ray 2 in the app and reuse prompt, aspect ratio and duration.' : isLumaFlash ? 'Open Ray 2 Flash in the app and reuse the draft setup.' : 'Open the app and reuse the prompt or start image setup.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Silent output', body: isPika ? 'No soundtrack is generated here; add sound and voice later.' : isLuma ? 'Ray 2 does not generate native audio on this MaxVideoAI route.' : isLumaFlash ? 'Ray 2 Flash does not generate native audio on this route.' : 'No native audio on this route; add sound and voice later.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
      { title: isPika ? 'Seeds and negatives' : isLuma || isLumaFlash ? 'Start image and edit' : 'Physics checks', body: isPika ? 'Keep a visual lane and block text, logos or artifacts.' : isLuma ? 'Animate a start frame, modify a source clip or reframe an approved master.' : isLumaFlash ? 'Animate a start frame or test Modify/Reframe from a source clip.' : 'Review force, collisions, cloth, water and ground contact.', icon: Users, tone: MODEL_PAGE_ICON_WRAP },
      { title: isPika ? 'Social first' : isLuma ? 'Ray 2 final route' : isLumaFlash ? 'Upgrade to Ray 2' : 'Draft route', body: isPika ? 'Built for short clips, overlays and loops you can edit later.' : isLuma ? 'Use Ray 2 for selected shots and final delivery variants.' : isLumaFlash ? 'Use Flash for iteration, then final selected shots on Ray 2.' : '512P/768P here; move approved shots to a final route.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
    ];
  }

  if (isSeedance15ProRoute(engineSlug)) {
    if (locale === 'fr') {
      return [
        { title: 'Rendus camera_fixed', body: `Voyez les plans verrouillés possibles avec ${modelName}.`, icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Recréer une variante', body: 'Ouvrez l’app avec le même seed, ratio et réglage caméra.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Audio on/off', body: 'Gardez l’audio natif ou coupez-le pour réduire le coût.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Images départ/fin', body: 'Utilisez une image initiale et une fin optionnelle en I2V.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Route legacy contrôlée', body: 'Idéal pour tests Seedance 1.5 répétables avant migration 2.0.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
      ];
    }
    if (locale === 'es') {
      return [
        { title: 'Renders camera_fixed', body: `Mira tomas bloqueadas posibles con ${modelName}.`, icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Recrear una variante', body: 'Abre la app con el mismo seed, ratio y ajuste de cámara.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Audio on/off', body: 'Mantén audio nativo o apágalo para reducir coste.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Frames inicial/final', body: 'Usa una imagen inicial y un final opcional en I2V.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Ruta legacy controlada', body: 'Útil para pruebas Seedance 1.5 repetibles antes de migrar a 2.0.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
      ];
    }
    return [
      { title: 'Camera-fixed renders', body: `See locked-camera shots possible with ${modelName}.`, icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Recreate a variant', body: 'Open the app with the same seed, ratio and camera setting.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Audio on/off', body: 'Keep native audio or switch it off for a lower quote.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Start/end frames', body: 'Use a start image and optional end frame in I2V.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Controlled legacy route', body: 'Useful for repeatable Seedance 1.5 tests before moving to 2.0.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
    ];
  }

  if (isKling34kRoute(engineSlug)) {
    if (locale === 'fr') {
      return [
        { title: 'Masters 4K natifs', body: `Voyez les rendus finaux possibles avec ${modelName}.`, icon: Maximize2, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Recréer un master', body: 'Ouvrez l’app avec Kling 3 4K et réutilisez le prompt validé.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Audio optionnel', body: 'Activez l’audio seulement s’il appartient au fichier de livraison.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Image source verrouillée', body: 'Gardez produit, cadrage et composition stables en image-to-video.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Prêt livraison', body: 'À réserver aux plans approuvés où le détail 4K justifie le coût.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
      ];
    }
    if (locale === 'es') {
      return [
        { title: 'Masters 4K nativos', body: `Mira renders finales posibles con ${modelName}.`, icon: Maximize2, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Recrear un master', body: 'Abre la app con Kling 3 4K y reutiliza el prompt aprobado.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Audio opcional', body: 'Activa audio solo cuando pertenece al archivo final.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Imagen fuente bloqueada', body: 'Mantén producto, encuadre y composición estables en image-to-video.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Listo para entrega', body: 'Úsalo en tomas aprobadas donde el detalle 4K justifica el coste.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
      ];
    }
    return [
      { title: 'Native 4K masters', body: `See final delivery renders possible with ${modelName}.`, icon: Maximize2, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Recreate a master', body: 'Open the app with Kling 3 4K and reuse the approved prompt.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Optional audio', body: 'Turn audio on only when it belongs in the delivery file.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Locked source image', body: 'Keep product, framing and composition stable in image-to-video.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Delivery ready', body: 'Reserved for approved shots where 4K detail justifies the cost.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
    ];
  }

  if (isKling3StandardRoute(engineSlug)) {
    if (locale === 'fr') {
      return [
        { title: 'Brouillons storyboard', body: `Voyez les tests multi-plans possibles avec ${modelName}.`, icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Recréer une variante', body: 'Ouvrez l’app avec Kling 3 Standard et réutilisez le setup.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Audio on/off', body: 'Testez avec audio natif ou gardez le brouillon silencieux.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Image source + fin', body: 'Ancrez le sujet avec une image source et une fin optionnelle.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Passage Pro', body: 'Montez les directions validées vers Pro pour plus de fidélité.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
      ];
    }
    if (locale === 'es') {
      return [
        { title: 'Borradores storyboard', body: `Mira pruebas multi-shot posibles con ${modelName}.`, icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Recrear una variante', body: 'Abre la app con Kling 3 Standard y reutiliza el setup.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Audio on/off', body: 'Prueba con audio nativo o mantén el borrador sin sonido.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Imagen fuente + final', body: 'Ancla el sujeto con imagen fuente y frame final opcional.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Pasar a Pro', body: 'Mueve direcciones aprobadas a Pro para más fidelidad.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
      ];
    }
    return [
      { title: 'Storyboard drafts', body: `See multi-shot tests possible with ${modelName}.`, icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Recreate a variant', body: 'Open the app with Kling 3 Standard and reuse the setup.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Audio on/off', body: 'Test with native audio or keep the draft silent for post.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Source + end frame', body: 'Anchor the subject with a source image and optional end frame.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Move to Pro', body: 'Move approved directions to Pro for stronger fidelity.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
    ];
  }

  if (isKling3ProRoute(engineSlug)) {
    if (locale === 'fr') {
      return [
        { title: 'Rendus Pro contrôlés', body: `Voyez les séquences premium possibles avec ${modelName}.`, icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Recréer un rendu', body: 'Ouvrez l’app avec Kling 3 Pro et réutilisez la configuration.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Audio + voix', body: 'Utilisez audio natif, lip sync et voice IDs quand le plan le demande.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Elements + end frame', body: 'Stabilisez sujet, produit et landing avec Elements et image finale.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Passe qualité', body: 'Gardez Pro pour les shots où fidélité et stabilité comptent.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
      ];
    }
    if (locale === 'es') {
      return [
        { title: 'Renders Pro controlados', body: `Mira secuencias premium posibles con ${modelName}.`, icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Recrear un render', body: 'Abre la app con Kling 3 Pro y reutiliza la configuración.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Audio + voces', body: 'Usa audio nativo, lip sync y voice IDs cuando la toma lo necesite.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Elements + frame final', body: 'Estabiliza sujeto, producto y landing con Elements y frame final.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
        { title: 'Pasada de calidad', body: 'Reserva Pro para tomas donde importen fidelidad y estabilidad.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
      ];
    }
    return [
      { title: 'Controlled Pro renders', body: `See premium sequences possible with ${modelName}.`, icon: Sparkles, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Recreate a render', body: 'Open the app with Kling 3 Pro and reuse the setup.', icon: Zap, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Audio + voices', body: 'Use native audio, lip sync and voice IDs when the shot needs it.', icon: AudioLines, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Elements + end frame', body: 'Stabilize subject, product and landing frame with Elements.', icon: ImageIcon, tone: MODEL_PAGE_ICON_WRAP },
      { title: 'Quality pass', body: 'Use Pro when fidelity and stability matter more than draft cost.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
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
    { title: 'Production-aware', body: 'Built-in guardrails and safety filters for responsible review.', icon: ShieldCheck, tone: MODEL_PAGE_ICON_WRAP },
  ];
}

function getDecisionExampleCategory(video: ExampleGalleryVideo, locale: AppLocale) {
  const tag = inferRenderTag(video.promptFull ?? video.prompt, locale);
  if (tag) return tag;
  if (video.hasAudio) return locale === 'fr' ? 'Cinématique' : locale === 'es' ? 'Cinemático' : 'Cinematic';
  return locale === 'fr' ? 'Render' : locale === 'es' ? 'Render' : 'Render';
}

function getCuratedDecisionExampleTitle(
  index: number,
  fallback: string,
  locale: AppLocale,
  useCuratedLabels: boolean,
  engineSlug?: string
) {
  if (!useCuratedLabels) return fallback;
  if (isLumaRay2Route(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Sparkling bottle hero', 'Night market motion', 'Vertical UGC reframe', 'Studio unboxing shot'],
      fr: ['Hero boisson pétillante', 'Mouvement marché de nuit', 'Reframe UGC vertical', 'Unboxing studio'],
      es: ['Hero de bebida espumosa', 'Movimiento mercado nocturno', 'Reframe UGC vertical', 'Unboxing en estudio'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isVeoLiteRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Ramen counter draft', 'Cyberpunk mood test', 'Romantic reunion test', 'Streetwear motion check'],
      fr: ['Brouillon comptoir ramen', 'Test ambiance cyberpunk', 'Test retrouvailles', 'Check mouvement streetwear'],
      es: ['Borrador barra ramen', 'Test ambiente cyberpunk', 'Test reencuentro', 'Check movimiento streetwear'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isVeoFastRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Soldier stepping into abandoned factory', 'Close-up interview shot', 'Late-night desk draft', 'Man talking about happiness'],
      fr: ['Soldat entrant dans une usine abandonnée', 'Interview en gros plan', 'Brouillon bureau de nuit', 'Homme parlant de bonheur'],
      es: ['Soldado entrando en fábrica abandonada', 'Entrevista en primer plano', 'Borrador de escritorio nocturno', 'Hombre hablando de felicidad'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isVeo31Route(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Wireless earbuds product ad', 'Premium brand hero shot', 'Reference-guided product reveal', 'First-last campaign beat'],
      fr: ['Pub produit écouteurs sans fil', 'Plan hero de marque premium', 'Reveal produit guidé par références', 'Beat campagne first-last'],
      es: ['Anuncio de auriculares inalámbricos', 'Toma hero de marca premium', 'Reveal de producto con referencias', 'Beat de campaña first-last'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isSeedance15ProRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Luxury perfume commercial', 'Cinematic car motion', 'Camera-fixed product shot', 'Cinematic storyboard beat'],
      fr: ['Spot parfum premium', 'Mouvement voiture cinématique', 'Plan produit camera-fixed', 'Beat storyboard cinématique'],
      es: ['Spot premium de perfume', 'Movimiento cinemático de auto', 'Toma de producto camera-fixed', 'Beat storyboard cinemático'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isSeedance20FastRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Pizzeria social draft', 'Brand reveal timing test', 'Space station reference check', 'Desert action draft pass'],
      fr: ['Brouillon social pizzeria', 'Test timing reveal de marque', 'Check référence station spatiale', 'Passe brouillon action désert'],
      es: ['Borrador social pizzería', 'Test de timing para reveal de marca', 'Check de referencia estación espacial', 'Borrador de acción en desierto'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isSora2ProRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Studio dialogue final', 'Restaurant character final', 'Vertical character take', 'Continuity control test'],
      fr: ['Finale dialogue studio', 'Finale personnage restaurant', 'Prise personnage verticale', 'Test contrôle continuité'],
      es: ['Final de diálogo en estudio', 'Final de personaje en restaurante', 'Toma vertical de personaje', 'Prueba de continuidad'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isSora2Route(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Hallway escape concept', 'Lifestyle product beat', 'Vertical social hook', 'Storyboard motion pass'],
      fr: ['Concept fuite couloir', 'Beat produit lifestyle', 'Hook social vertical', 'Passe motion storyboard'],
      es: ['Concepto escape pasillo', 'Beat producto lifestyle', 'Hook social vertical', 'Pasada motion storyboard'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isLtx23FastRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Boxer tunnel draft', 'Glowing tech motion', 'Space product test', 'Desert vehicle pass'],
      fr: ['Brouillon boxer tunnel', 'Motion tech lumineux', 'Test produit spatial', 'Passe véhicule désert'],
      es: ['Borrador boxer túnel', 'Motion tech luminoso', 'Prueba producto espacial', 'Pasada vehículo desierto'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isLtx23ProRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Astronaut source image test', 'Portrait motion handoff', 'Sword action retake', 'Office gag retake'],
      fr: ['Test image source astronaute', 'Handoff motion portrait', 'Retake action épée', 'Retake gag bureau'],
      es: ['Test imagen fuente astronauta', 'Handoff motion retrato', 'Retake acción espada', 'Retake gag oficina'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isKling34kRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Native 4K product master', 'Large-screen campaign render', 'Approved image-to-video final', 'Vertical 4K delivery pass'],
      fr: ['Master produit 4K natif', 'Rendu campagne grand écran', 'Final image-vers-vidéo approuvé', 'Passe verticale 4K'],
      es: ['Master de producto 4K nativo', 'Render campaña pantalla grande', 'Final imagen-a-video aprobado', 'Pasada vertical 4K'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isKling3StandardRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Neon storyboard draft', 'Product beat test', 'Image-to-video landing', 'Social promo variant'],
      fr: ['Brouillon storyboard néon', 'Test beat produit', 'Landing image-vers-vidéo', 'Variante promo sociale'],
      es: ['Borrador storyboard neon', 'Prueba beat producto', 'Landing imagen-a-video', 'Variante promo social'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isKling3ProRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Neon street multi-shot', 'Product launch sequence', 'Voice-led promo beat', 'Image-to-video final pose'],
      fr: ['Multi-plan rue néon', 'Séquence lancement produit', 'Beat promo avec voix', 'Pose finale image-vidéo'],
      es: ['Multi-shot calle neon', 'Secuencia lanzamiento producto', 'Beat promo con voz', 'Pose final imagen-video'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  const labels: Record<AppLocale, string[]> = {
    en: ['Parkour rooftop run', 'Trading desk intensity', 'Clothing try-on moment', 'Narrative reunion'],
    fr: ['Parkour sur toit', 'Intensité en salle de trading', 'Essayage de vêtement', 'Retrouvailles narratives'],
    es: ['Parkour en azotea', 'Intensidad mesa de trading', 'Prueba de ropa', 'Reencuentro narrativo'],
  };
  return labels[locale]?.[index] ?? fallback;
}

function getCuratedDecisionExampleCategory(
  index: number,
  fallback: string,
  locale: AppLocale,
  useCuratedLabels: boolean,
  engineSlug?: string
) {
  if (!useCuratedLabels) return fallback;
  if (isLumaRay2Route(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Product · Hero', 'Cinematic · Motion', 'Vertical · Social', 'Product · Studio'],
      fr: ['Produit · Hero', 'Cinématique · Mouvement', 'Vertical · Social', 'Produit · Studio'],
      es: ['Producto · Hero', 'Cinemático · Movimiento', 'Vertical · Social', 'Producto · Estudio'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isVeoLiteRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Social · Food', 'Cinematic · Mood', 'Narrative · Audio', 'Fashion · Motion'],
      fr: ['Social · Food', 'Cinématique · Mood', 'Narratif · Audio', 'Mode · Mouvement'],
      es: ['Social · Food', 'Cinemático · Mood', 'Narrativa · Audio', 'Moda · Movimiento'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isVeoFastRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Cinematic · Action', 'Interview · Close-up', 'Desk · Draft', 'Dialogue · Audio'],
      fr: ['Cinématique · Action', 'Interview · Gros plan', 'Bureau · Brouillon', 'Dialogue · Audio'],
      es: ['Cinemático · Acción', 'Entrevista · Primer plano', 'Escritorio · Borrador', 'Diálogo · Audio'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isVeo31Route(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Product / Ad', 'Brand · Hero', 'Product · References', 'Campaign · First/Last'],
      fr: ['Produit / Pub', 'Marque · Hero', 'Produit · Références', 'Campagne · First/Last'],
      es: ['Producto / Anuncio', 'Marca · Hero', 'Producto · Referencias', 'Campaña · First/Last'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isSeedance15ProRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Product · Beauty', 'Cinematic · Vehicle', 'Product · Camera fixed', 'Cinematic · Control test'],
      fr: ['Produit · Beauté', 'Cinématique · Véhicule', 'Produit · Camera fixed', 'Cinématique · Test contrôle'],
      es: ['Producto · Belleza', 'Cinemático · Vehículo', 'Producto · Camera fixed', 'Cinemático · Prueba de control'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isSeedance20FastRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Social · Food', 'Brand · Motion test', 'Reference · Continuity', 'Cinematic · Draft'],
      fr: ['Social · Food', 'Marque · Test motion', 'Référence · Continuité', 'Cinématique · Brouillon'],
      es: ['Social · Food', 'Marca · Test motion', 'Referencia · Continuidad', 'Cinemático · Borrador'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isSora2ProRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Production · Dialogue', 'Narrative · Character', 'Vertical · Social', 'Production · Continuity'],
      fr: ['Production · Dialogue', 'Narratif · Personnage', 'Vertical · Social', 'Production · Continuité'],
      es: ['Producción · Diálogo', 'Narrativa · Personaje', 'Vertical · Social', 'Producción · Continuidad'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isSora2Route(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Cinematic · Concept', 'Lifestyle · Product', 'Vertical · Social', 'Storyboard · Motion'],
      fr: ['Cinématique · Concept', 'Lifestyle · Produit', 'Vertical · Social', 'Storyboard · Motion'],
      es: ['Cinemático · Concepto', 'Lifestyle · Producto', 'Vertical · Social', 'Storyboard · Motion'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isLtx23FastRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Cinematic · Draft', 'Corporate · Motion', 'Product · Draft', 'Cinematic · Vehicle'],
      fr: ['Cinématique · Brouillon', 'Corporate · Motion', 'Produit · Brouillon', 'Cinématique · Véhicule'],
      es: ['Cinemático · Borrador', 'Corporativo · Motion', 'Producto · Borrador', 'Cinemático · Vehículo'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isLtx23ProRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Image-to-video · Source', 'Portrait · Motion', 'Retake · Action', 'Retake · Comedy'],
      fr: ['Image-to-video · Source', 'Portrait · Motion', 'Retake · Action', 'Retake · Comédie'],
      es: ['Imagen a video · Fuente', 'Retrato · Motion', 'Retake · Acción', 'Retake · Comedia'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isKling34kRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Product · 4K master', 'Campaign · Delivery', 'Image-to-video · Final', 'Vertical · 4K'],
      fr: ['Produit · Master 4K', 'Campagne · Livraison', 'Image-vidéo · Final', 'Vertical · 4K'],
      es: ['Producto · Master 4K', 'Campaña · Entrega', 'Imagen-video · Final', 'Vertical · 4K'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isKling3StandardRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Storyboard · Draft', 'Product · Test', 'Image-to-video · Draft', 'Social · Variant'],
      fr: ['Storyboard · Brouillon', 'Produit · Test', 'Image-vidéo · Brouillon', 'Social · Variante'],
      es: ['Storyboard · Borrador', 'Producto · Test', 'Imagen-video · Borrador', 'Social · Variante'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
  if (isKling3ProRoute(engineSlug)) {
    const labels: Record<AppLocale, string[]> = {
      en: ['Cinematic · Multi-shot', 'Product · Launch', 'Audio · Voice', 'Image-to-video · Control'],
      fr: ['Cinématique · Multi-plan', 'Produit · Lancement', 'Audio · Voix', 'Image-vidéo · Contrôle'],
      es: ['Cinemático · Multi-shot', 'Producto · Lanzamiento', 'Audio · Voz', 'Imagen-video · Control'],
    };
    return labels[locale]?.[index] ?? fallback;
  }
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
  isImageEngine: boolean,
  engineSlug?: string
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
  if (video.hasAudio && !isSilentVideoDecisionEngine(engineSlug)) tags.add('audio');
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
  engineSlug,
}: {
  galleryVideos: ExampleGalleryVideo[];
  galleryPreviewAlts: Map<string, string>;
  locale: AppLocale;
  copy: SoraCopy;
  isImageEngine: boolean;
  engineSlug: string;
}): DecisionExampleGalleryItem[] {
  const useCuratedLabels = false;
  const isSilentDraftEngine = isSilentVideoDecisionEngine(engineSlug);

  return galleryVideos.map((video, index) => {
    const fallbackTitle = deriveShortPromptLabel(video.promptFull ?? video.prompt, locale);
    const shortTitle = getCuratedDecisionExampleTitle(index, fallbackTitle, locale, useCuratedLabels, engineSlug);
    const category = getCuratedDecisionExampleCategory(
      index,
      getDecisionExampleCategory(video, locale),
      locale,
      useCuratedLabels,
      engineSlug
    );
    const aspectRatio = getDisplayAspectRatio(video);
    const posterUrl = video.optimizedPosterUrl ?? video.rawPosterUrl ?? '';
    return {
      id: video.id,
      href: video.href,
      posterUrl,
      alt: isLumaRay2Route(engineSlug)
        ? `Luma Ray 2 ${shortTitle.toLowerCase()}`
        : isLumaRay32Route(engineSlug)
          ? `Luma Ray 3.2 ${shortTitle.toLowerCase()}`
        : isSora2ProRoute(engineSlug)
          ? `Sora 2 Pro ${shortTitle.toLowerCase()}`
        : isSora2Route(engineSlug)
          ? `Sora 2 ${shortTitle.toLowerCase()}`
        : isLtx23FastRoute(engineSlug)
          ? `LTX 2.3 Fast ${shortTitle.toLowerCase()}`
        : isLtx23ProRoute(engineSlug)
          ? `LTX 2.3 Pro ${shortTitle.toLowerCase()}`
        : isKling3ProRoute(engineSlug)
          ? `Kling 3 Pro ${shortTitle.toLowerCase()}`
        : isKling34kRoute(engineSlug)
          ? `Kling 3 4K ${shortTitle.toLowerCase()}`
        : isKling3StandardRoute(engineSlug)
          ? `Kling 3 Standard ${shortTitle.toLowerCase()}`
        : isVeoLiteRoute(engineSlug)
          ? `Veo 3.1 Lite ${shortTitle.toLowerCase()}`
        : isVeo31Route(engineSlug)
          ? `Veo 3.1 ${shortTitle.toLowerCase()}`
        : isVeoFastRoute(engineSlug)
          ? `Veo 3.1 Fast ${shortTitle.toLowerCase()}`
        : isSeedance20FastRoute(engineSlug)
          ? `Seedance 2.0 Fast ${shortTitle.toLowerCase()}`
          : isSeedance15ProRoute(engineSlug)
            ? `Seedance 1.5 Pro ${shortTitle.toLowerCase()}`
          : (galleryPreviewAlts.get(video.id) ?? `${video.engineLabel} example: ${shortTitle}`),
      audioBadgeLabel: isImageEngine ? null : isSilentDraftEngine ? getSilentBadgeLabel(locale) : getAudioBadgeLabel(video, locale),
      durationLabel: isImageEngine ? null : getDurationLabel(video, locale),
      aspectRatio,
      category,
      title: shortTitle,
      recreateHref: video.recreateHref ?? null,
      recreateLabel: copy.recreateLabel ?? null,
      tags: getDecisionExampleTags(video, category, aspectRatio, isImageEngine, engineSlug),
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
  const isNanoBananaLite = engineSlug === 'nano-banana-lite';
  const isNanoBanana = engineSlug === 'nano-banana';
  const isSeedreamPro = engineSlug === 'seedream-5-0-pro';
  const isSeedream = engineSlug === 'seedream';
  const isGptImage2 = engineSlug === 'gpt-image-2';
  const fallbackPosters: Record<string, Record<string, string>> = {
    'seedream-5-0-pro': {
      infographic: '/assets/model-examples/seedream-5-0-pro/hero.webp',
      campaign: '/assets/model-examples/seedream-5-0-pro/campaign.webp',
      edit: '/assets/model-examples/seedream-5-0-pro/edit.webp',
      final: '/assets/model-examples/seedream-5-0-pro/final.webp',
    },
    seedream: {
      product: '/assets/model-examples/seedream/product.webp',
      character: '/assets/model-examples/seedream/character.webp',
      edit: '/assets/model-examples/seedream/edit.webp',
      batch: '/assets/model-examples/seedream/batch.webp',
    },
    'gpt-image-2': {
      product: '/assets/model-examples/gpt-image-2/product.webp',
      typography: '/assets/model-examples/gpt-image-2/typography.webp',
      ui: '/assets/model-examples/gpt-image-2/ui.webp',
      edit: '/assets/model-examples/gpt-image-2/edit.webp',
      mask: '/assets/model-examples/gpt-image-2/mask.webp',
      final: '/assets/model-examples/gpt-image-2/final.webp',
    },
    'nano-banana': {
      campaign: '/assets/model-examples/nano-banana/campaign.webp',
      typography: '/assets/model-examples/nano-banana/typography.webp',
      reference: '/assets/model-examples/nano-banana/reference.webp',
      final: '/assets/model-examples/nano-banana/final.webp',
    },
    'nano-banana-lite': {
      campaign: '/assets/model-examples/nano-banana-lite/hero.webp',
      edit: '/assets/model-examples/nano-banana-lite/edit.webp',
      reference: '/assets/model-examples/nano-banana-lite/reference.webp',
      batch: '/assets/model-examples/nano-banana-lite/batch.webp',
    },
    'nano-banana-2': {
      grounded: '/assets/model-examples/nano-banana-2/grounded.webp',
      edit: '/assets/model-examples/nano-banana-2/edit.webp',
      reference: '/assets/model-examples/nano-banana-2/reference.webp',
      wide: '/assets/model-examples/nano-banana-2/wide.webp',
    },
    'luma-uni-1': {
      product: '/assets/model-examples/luma-uni-1/product.webp',
      edit: '/assets/model-examples/luma-uni-1/edit.webp',
      reference: '/assets/model-examples/luma-uni-1/reference.webp',
      campaign: '/assets/model-examples/luma-uni-1/research.webp',
    },
    'luma-uni-1-max': {
      product: '/assets/model-examples/luma-uni-1-max/hero-product.webp',
      typography: '/assets/model-examples/luma-uni-1-max/typography.webp',
      edit: '/assets/model-examples/luma-uni-1-max/edit.webp',
      reference: '/assets/model-examples/luma-uni-1-max/reference.webp',
    },
    'nano-banana-pro': {
      campaign: '/assets/model-examples/nano-banana-pro/campaign.webp',
      typography: '/assets/model-examples/nano-banana-pro/typography.webp',
      reference: '/assets/model-examples/nano-banana-pro/reference.webp',
      final: '/assets/model-examples/nano-banana-pro/final.webp',
    },
  };
  const resolvePoster = (tag: string) => fallbackPosters[engineSlug]?.[tag] ?? fallbackImageUrl ?? '';
  const examples = isNanoBananaLite
    ? locale === 'fr'
      ? [
          ['campaign', 'Concept street 1K', 'Draft 1K', '1K', 'Concept Nano Banana Lite dynamique pour exploration sociale rapide'],
          ['edit', 'Edit veste local', 'Edit', '1K edit', 'Edit Nano Banana Lite qui transforme la tenue tout en gardant pose et sujet'],
          ['reference', 'Remix de références', 'Références', '14 refs max', 'Remix Nano Banana Lite guidé par portrait, matière et ambiance'],
          ['batch', 'Board de variantes', 'Variantes', '4 drafts', 'Board Nano Banana Lite de quatre directions visuelles rapides'],
        ]
      : locale === 'es'
        ? [
            ['campaign', 'Concepto street 1K', 'Draft 1K', '1K', 'Concepto Nano Banana Lite dinámico para exploración social rápida'],
            ['edit', 'Edit local de chaqueta', 'Edit', '1K edit', 'Edit Nano Banana Lite que transforma la ropa manteniendo pose y sujeto'],
            ['reference', 'Remix de referencias', 'Referencias', '14 refs max', 'Remix Nano Banana Lite guiado por retrato, material y ambiente'],
            ['batch', 'Board de variantes', 'Variantes', '4 drafts', 'Board Nano Banana Lite con cuatro direcciones visuales rápidas'],
          ]
        : [
            ['campaign', 'Fast street concept', '1K draft', '1K', 'Nano Banana Lite dynamic street concept for rapid social exploration'],
            ['edit', 'Local jacket edit', 'Edit', '1K edit', 'Nano Banana Lite edit changing the jacket while preserving pose and subject'],
            ['reference', 'Reference remix portrait', 'References', '14 refs max', 'Nano Banana Lite remix guided by portrait, material, and mood references'],
            ['batch', 'Variant concept board', 'Variants', '4 drafts', 'Nano Banana Lite four-direction visual exploration board'],
          ]
    : isSeedreamPro
    ? locale === 'fr'
      ? [
          ['infographic', 'Infographie ville énergie', 'Infographie', '4K', 'Infographie Seedream 5.0 Pro dense sur un district énergie propre'],
          ['campaign', 'Still campagne cinématique', 'Campagne', '4K', 'Still campagne Seedream 5.0 Pro avec composition commerciale premium'],
          ['edit', 'Composite multi-références', 'Edit', '10 refs max', 'Composite Seedream 5.0 Pro fusionnant sujet, décor, matière et mood'],
          ['final', 'Frame prêt vidéo', 'Frame final', '4K', 'Frame Seedream 5.0 Pro prêt à servir de source pour animation Seedance'],
        ]
      : locale === 'es'
        ? [
            ['infographic', 'Infografía ciudad energía', 'Infografía', '4K', 'Infografía Seedream 5.0 Pro densa sobre un distrito de energía limpia'],
            ['campaign', 'Still de campaña cinematográfico', 'Campaña', '4K', 'Still Seedream 5.0 Pro con composición comercial premium'],
            ['edit', 'Composite multi-referencia', 'Edit', '10 refs max', 'Composite Seedream 5.0 Pro que une sujeto, entorno, material y mood'],
            ['final', 'Frame listo para video', 'Frame final', '4K', 'Frame Seedream 5.0 Pro listo como fuente para animación Seedance'],
          ]
        : [
            ['infographic', 'Clean-energy city infographic', 'Infographic', '4K', 'Seedream 5.0 Pro dense clean-energy district infographic'],
            ['campaign', 'Cinematic campaign still', 'Campaign', '4K', 'Seedream 5.0 Pro premium commercial campaign composition'],
            ['edit', 'Multi-reference composite', 'Edit', '10 refs max', 'Seedream 5.0 Pro composite merging subject, setting, material, and mood references'],
            ['final', 'Video-ready keyframe', 'Final frame', '4K', 'Seedream 5.0 Pro source frame prepared for Seedance animation'],
          ]
    : isSeedream
    ? locale === 'fr'
      ? [
          ['product', 'Still produit de référence', 'Produit · 2K', '2K', 'Still produit Seedream préparé comme référence propre'],
          ['character', 'Planche personnage', 'Personnage', '2-10 refs', 'Planche Seedream avec plusieurs vues cohérentes du même personnage'],
          ['edit', 'Retouche image propre', 'Edit', 'Image edit', 'Retouche Seedream qui préserve forme, logo et proportions'],
          ['batch', 'Batch storyboard', 'Batch', '4 images', 'Batch Seedream de quatre images cohérentes pour storyboard'],
        ]
      : locale === 'es'
        ? [
            ['product', 'Still de producto', 'Producto · 2K', '2K', 'Still de producto Seedream preparado como referencia limpia'],
            ['character', 'Hoja de personaje', 'Personaje', '2-10 refs', 'Hoja Seedream con varias vistas coherentes del mismo personaje'],
            ['edit', 'Edición limpia', 'Edit', 'Image edit', 'Edición Seedream que conserva forma, logo y proporciones'],
            ['batch', 'Batch storyboard', 'Batch', '4 imágenes', 'Batch Seedream de cuatro imágenes coherentes para storyboard'],
          ]
        : [
            ['product', 'Product reference still', 'Product · 2K', '2K', 'Seedream product still prepared as a clean reference image'],
            ['character', 'Character reference sheet', 'Character', '2-10 refs', 'Seedream sheet with consistent views of the same character'],
            ['edit', 'Clean image edit', 'Edit', 'Image edit', 'Seedream edit preserving shape, logo and proportions'],
            ['batch', 'Storyboard batch', 'Batch', '4 images', 'Seedream four-image storyboard batch'],
          ]
    : isLumaUni1Route(engineSlug)
    ? locale === 'fr'
      ? [
          ['product', 'Still produit 2K', 'Produit', '2K · 16:9', 'Packshot Luma Uni-1 avec lumiere studio simple'],
          ['edit', 'Edit image source', 'Edit', 'Image edit', 'Edit Luma Uni-1 qui garde la forme produit et change le mood studio'],
          ['reference', 'Still guide par references', 'References', '2 refs', 'Still Luma Uni-1 guide par produit et reference mood'],
          ['campaign', 'Recherche direction visuelle', 'Direction', '1:1', 'Still Luma Uni-1 pour explorer une direction retail'],
        ]
      : locale === 'es'
        ? [
            ['product', 'Still de producto 2K', 'Producto', '2K · 16:9', 'Packshot Luma Uni-1 con luz de estudio simple'],
            ['edit', 'Edit de imagen fuente', 'Edit', 'Image edit', 'Edit Luma Uni-1 que conserva forma de producto y cambia mood de estudio'],
            ['reference', 'Still guiado por referencias', 'Referencias', '2 refs', 'Still Luma Uni-1 guiado por producto y referencia de mood'],
            ['campaign', 'Investigacion visual', 'Direccion', '1:1', 'Still Luma Uni-1 para explorar una direccion retail'],
          ]
        : [
            ['product', '2K product still', 'Product', '2K · 16:9', 'Luma Uni-1 clean product still with simple studio light'],
            ['edit', 'Source image edit', 'Edit', 'Image edit', 'Luma Uni-1 edit preserving product shape while changing studio tone'],
            ['reference', 'Reference-led still', 'References', '2 refs', 'Luma Uni-1 still guided by product and mood references'],
            ['campaign', 'Visual research still', 'Direction', '1:1', 'Luma Uni-1 retail research still for product direction'],
          ]
    : isLumaUni1MaxRoute(engineSlug)
    ? locale === 'fr'
      ? [
          ['product', 'Packshot haute fidelite', 'Produit', '2K · 3:2', 'Packshot skincare Luma Uni-1 Max avec detail premium'],
          ['typography', 'Poster texte lisible', 'Typographie', 'Poster', 'Poster Luma Uni-1 Max avec titre NIGHT GARDEN lisible'],
          ['edit', 'Edit produit detaille', 'Edit', 'Image edit', 'Edit Luma Uni-1 Max avec matiere et contours plus nets'],
          ['reference', 'Still campagne reference', 'References', '2 refs', 'Still Luma Uni-1 Max guide par produit et mood campagne'],
        ]
      : locale === 'es'
        ? [
            ['product', 'Packshot de alta fidelidad', 'Producto', '2K · 3:2', 'Packshot skincare Luma Uni-1 Max con detalle premium'],
            ['typography', 'Poster con texto legible', 'Tipografia', 'Poster', 'Poster Luma Uni-1 Max con titular NIGHT GARDEN legible'],
            ['edit', 'Edit de producto detallado', 'Edit', 'Image edit', 'Edit Luma Uni-1 Max con material y bordes mas nitidos'],
            ['reference', 'Still de campana con referencia', 'Referencias', '2 refs', 'Still Luma Uni-1 Max guiado por producto y mood de campana'],
          ]
        : [
            ['product', 'High-fidelity product still', 'Product', '2K · 3:2', 'Luma Uni-1 Max premium skincare product still'],
            ['typography', 'Readable poster concept', 'Typography', 'Poster', 'Luma Uni-1 Max poster with readable NIGHT GARDEN headline'],
            ['edit', 'Detailed product edit', 'Edit', 'Image edit', 'Luma Uni-1 Max edit improving material realism and edge detail'],
            ['reference', 'Campaign reference still', 'References', '2 refs', 'Luma Uni-1 Max launch still guided by product and mood references'],
          ]
    : isNanoBanana2
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
    : isGptImage2
    ? locale === 'fr'
      ? [
          ['product', 'Packshot produit texte', 'Produit', '1024x768 · High', 'Packshot GPT Image 2 avec label produit lisible'],
          ['typography', 'Poster typographique', 'Texte lisible', '4K', 'Poster GPT Image 2 avec hiérarchie typographique nette'],
          ['ui', 'Mockup UI', 'UI', '1920x1080', 'Mockup d’écran GPT Image 2 avec interface lisible'],
          ['edit', 'Retouche produit', 'Edit image', 'Auto', 'Retouche GPT Image 2 qui préserve produit et label'],
          ['mask', 'Edit guidé par masque', 'Masque', 'Mask URL', 'Retouche GPT Image 2 limitée à une zone masquée'],
          ['final', 'Hero still 4K', 'Final', '3840x2160', 'Still hero GPT Image 2 en 4K avec détails produit nets'],
        ]
      : locale === 'es'
        ? [
            ['product', 'Still de producto con texto', 'Producto', '1024x768 · High', 'Still GPT Image 2 con etiqueta de producto legible'],
            ['typography', 'Póster tipográfico', 'Texto legible', '4K', 'Póster GPT Image 2 con jerarquía tipográfica clara'],
            ['ui', 'Mockup UI', 'UI', '1920x1080', 'Mockup de pantalla GPT Image 2 con interfaz legible'],
            ['edit', 'Edición de producto', 'Edit de imagen', 'Auto', 'Edición GPT Image 2 que conserva producto y etiqueta'],
            ['mask', 'Edit con máscara', 'Máscara', 'Mask URL', 'Edición GPT Image 2 limitada a una zona con máscara'],
            ['final', 'Hero still 4K', 'Final', '3840x2160', 'Still hero GPT Image 2 en 4K con detalle de producto nítido'],
          ]
        : [
            ['product', 'Product still with text', 'Product', '1024x768 · High', 'GPT Image 2 product still with readable packaging label'],
            ['typography', 'Readable typography poster', 'Readable text', '4K', 'GPT Image 2 poster with crisp typography hierarchy'],
            ['ui', 'UI mockup', 'UI', '1920x1080', 'GPT Image 2 app screen mockup with readable interface copy'],
            ['edit', 'Controlled product edit', 'Image edit', 'Auto', 'GPT Image 2 edit preserving product shape and label'],
            ['mask', 'Mask-guided edit', 'Mask edit', 'Mask URL', 'GPT Image 2 edit constrained to a masked region'],
            ['final', '4K hero still', 'Final', '3840x2160', 'GPT Image 2 4K hero still with sharp product details'],
          ]
    : isNanoBanana
    ? locale === 'fr'
      ? [
          ['campaign', 'Concept thumbnail rapide', 'Brouillon', '16:9', 'Concept visuel Nano Banana pour miniature social'],
          ['typography', 'Promo simple lisible', 'Typographie', '1:1', 'Image Nano Banana avec message promotionnel court'],
          ['reference', 'Remix de référence', 'Référence', '4:3', 'Remix Nano Banana guidé par une référence visuelle'],
          ['final', 'Batch de variantes', 'Batch', '4 variantes', 'Quatre variantes Nano Banana pour exploration rapide'],
        ]
      : locale === 'es'
        ? [
            ['campaign', 'Concepto thumbnail rápido', 'Borrador', '16:9', 'Concepto visual Nano Banana para miniatura social'],
            ['typography', 'Promo simple legible', 'Tipografía', '1:1', 'Imagen Nano Banana con mensaje promocional corto'],
            ['reference', 'Remix con referencia', 'Referencia', '4:3', 'Remix Nano Banana guiado por una referencia visual'],
            ['final', 'Batch de variantes', 'Batch', '4 variantes', 'Cuatro variantes Nano Banana para exploración rápida'],
          ]
        : [
            ['campaign', 'Fast thumbnail concept', 'Draft', '16:9', 'Nano Banana visual concept for a social thumbnail'],
            ['typography', 'Simple promo still', 'Typography', '1:1', 'Nano Banana still with short readable promo copy'],
            ['reference', 'Reference remix', 'Reference', '4:3', 'Nano Banana remix guided by a visual reference'],
            ['final', 'Batch concept grid', 'Batch', '4 variants', 'Nano Banana four-variant exploration grid'],
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
    posterUrl: resolvePoster(tag),
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
  const proofItems = getDecisionExampleProofItems(locale, modelName, isImageEngine, engineSlug);
  const title = copy.galleryTitle ?? getFallbackExamplesTitle(locale, modelName);
  const intro = copy.galleryIntro ?? getFallbackExamplesIntro(locale, modelName);
  const galleryItems = buildDecisionExampleItems({ galleryVideos, galleryPreviewAlts, locale, copy, isImageEngine, engineSlug });
  const fallbackItems = isImageEngine
    ? buildImageFallbackExampleItems({ copy, engineSlug, fallbackImageUrl, locale })
    : [];
  const items = galleryItems.length ? galleryItems : fallbackItems;
  const resolvedExamplesLinkHref = isImageEngine && !galleryVideos.length ? null : examplesLinkHref;
  const filters = getAvailableDecisionExampleFilters(locale, items, isImageEngine, engineSlug);

  return (
    <section id={textAnchorId} className={SECTION_SCROLL_MARGIN}>
      <div className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:bg-slate-950/72 dark:shadow-[0_24px_70px_-42px_rgba(0,0,0,0.85)] sm:p-7">
        <ModelDecisionExamplesGallery
          title={title}
          intro={intro}
          filters={filters}
          items={items}
          examplesLinkHref={resolvedExamplesLinkHref}
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
