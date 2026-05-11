import { Clapperboard, Copy, Film, Sparkles, Timer, Wallet, Wand2, type LucideIcon } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import type { ModelsPageScope } from './models-catalog-utils';

export type ModelsOutcomeTile = {
  title: string;
  description: string;
  engines: string[];
  icon: LucideIcon;
};

export type ModelsFaqItem = {
  question: string;
  answer: string;
};

export type ModelsReliabilityItem = {
  title: string;
  body: string;
  icon: LucideIcon;
};

export function buildModelsOutcomeTiles({
  activeLocale,
  outcomeCopy,
  scope,
}: {
  activeLocale: AppLocale;
  outcomeCopy: Array<{ title?: string; description?: string }>;
  scope: ModelsPageScope;
}): ModelsOutcomeTile[] {
  if (scope === 'video') {
    return [
      {
        title: outcomeCopy[0]?.title ?? 'Text-to-video models',
        description: outcomeCopy[0]?.description ?? 'Shortlist models that support prompt-only generation.',
        engines: ['seedance-2-0', 'seedance-2-0-fast', 'kling-3-pro', 'veo-3-1', 'ltx-2-3-pro', 'sora-2'],
        icon: Film,
      },
      {
        title: outcomeCopy[1]?.title ?? 'Image-to-video models',
        description: outcomeCopy[1]?.description ?? 'Check which models support references and image-led workflows.',
        engines: ['seedance-2-0', 'seedance-2-0-fast', 'veo-3-1', 'veo-3-1-fast', 'wan-2-6', 'ltx-2-3-pro'],
        icon: Clapperboard,
      },
      {
        title: outcomeCopy[2]?.title ?? 'Video-to-video and extension support',
        description: outcomeCopy[2]?.description ?? 'Identify models that support continuation or edit-style workflows.',
        engines: ['wan-2-6', 'kling-3-standard', 'kling-3-pro', 'veo-3-1'],
        icon: Timer,
      },
      {
        title: outcomeCopy[3]?.title ?? 'Limits and formats',
        description: outcomeCopy[3]?.description ?? 'Duration, max resolution, audio, and format constraints by model.',
        engines: ['seedance-2-0', 'kling-3-pro', 'kling-3-4k', 'veo-3-1', 'ltx-2-3-pro', 'sora-2'],
        icon: Sparkles,
      },
      {
        title: outcomeCopy[4]?.title ?? 'Pricing per model and mode',
        description: outcomeCopy[4]?.description ?? 'Use per-second pricing and mode support to estimate cost accurately.',
        engines: ['seedance-2-0', 'seedance-2-0-fast', 'kling-3-standard', 'kling-3-4k', 'veo-3-1', 'ltx-2-3-fast', 'wan-2-6'],
        icon: Wand2,
      },
      {
        title: outcomeCopy[5]?.title ?? 'Examples and prompt references',
        description: outcomeCopy[5]?.description ?? 'Open real outputs per model before selecting your production preset.',
        engines: ['seedance-2-0', 'seedance-2-0-fast', 'kling-3-pro', 'veo-3-1', 'ltx-2-3-pro'],
        icon: Copy,
      },
    ];
  }

  if (scope === 'image') {
    return [
      {
        title: activeLocale === 'fr' ? 'Texte→image' : activeLocale === 'es' ? 'Texto→imagen' : 'Text-to-image',
        description:
          activeLocale === 'fr'
            ? "Repérez les modèles pour générer des images fixes sans références d'entrée."
            : activeLocale === 'es'
              ? 'Identifica modelos para generar imágenes fijas sin referencias de entrada.'
              : 'Shortlist models for still generation without source references.',
        engines: ['seedream', 'gpt-image-2', 'nano-banana-2'],
        icon: Film,
      },
      {
        title: activeLocale === 'fr' ? 'Édition guidée par image' : activeLocale === 'es' ? 'Edición guiada por imagen' : 'Image-guided editing',
        description:
          activeLocale === 'fr'
            ? "Vérifiez quels modèles gèrent le mieux les références et les retouches multi-image."
            : activeLocale === 'es'
              ? 'Comprueba qué modelos manejan mejor las referencias y la edición con varias imágenes.'
              : 'Check which models best support references and multi-image edits.',
        engines: ['seedream', 'gpt-image-2', 'nano-banana-2'],
        icon: Clapperboard,
      },
      {
        title: activeLocale === 'fr' ? 'Ratios et formats de sortie' : activeLocale === 'es' ? 'Ratios y formatos de salida' : 'Aspect ratios and output formats',
        description:
          activeLocale === 'fr'
            ? 'Passez en revue les ratios larges, extrêmes et les formats de fichier disponibles.'
            : activeLocale === 'es'
              ? 'Revisa ratios amplios, extremos y formatos de archivo disponibles.'
              : 'Review wide and extreme aspect ratios plus available file formats.',
        engines: ['seedream', 'gpt-image-2', 'nano-banana-2'],
        icon: Sparkles,
      },
      {
        title: activeLocale === 'fr' ? 'Limites de références' : activeLocale === 'es' ? 'Límites de referencias' : 'Reference limits',
        description:
          activeLocale === 'fr'
            ? 'Vérifiez combien d’images de référence chaque modèle accepte en edit.'
            : activeLocale === 'es'
              ? 'Comprueba cuántas imágenes de referencia acepta cada modelo en edit.'
              : 'Check how many reference images each model accepts for edit runs.',
        engines: ['seedream', 'gpt-image-2', 'nano-banana-2'],
        icon: Timer,
      },
      {
        title: activeLocale === 'fr' ? 'Prix par image' : activeLocale === 'es' ? 'Precio por imagen' : 'Per-image pricing',
        description:
          activeLocale === 'fr'
            ? 'Comparez tests, finals et coûts annexes comme le grounding web.'
            : activeLocale === 'es'
              ? 'Compara drafts, finales y costes extra como grounding web.'
              : 'Compare draft, final, and add-on costs such as web grounding.',
        engines: ['seedream', 'gpt-image-2', 'nano-banana-2'],
        icon: Wand2,
      },
      {
        title: activeLocale === 'fr' ? 'Pages modèle et repères' : activeLocale === 'es' ? 'Páginas de modelo y guía' : 'Model pages and guidance',
        description:
          activeLocale === 'fr'
            ? 'Ouvrez les fiches modèle pour les prompts, les repères utiles et les contraintes détaillées.'
            : activeLocale === 'es'
              ? 'Abre las fichas de modelo para prompts, recomendaciones y restricciones detalladas.'
              : 'Open model profiles for prompts, tips, and detailed constraints.',
        engines: ['seedream', 'gpt-image-2', 'nano-banana-2'],
        icon: Copy,
      },
    ];
  }

  return [
    {
      title: activeLocale === 'fr' ? 'Modèles vidéo' : activeLocale === 'es' ? 'Modelos de video' : 'Video models',
      description:
        activeLocale === 'fr'
          ? 'Passez aux modèles vidéo pour le rendu, le comparateur et les workflows de mouvement.'
          : activeLocale === 'es'
            ? 'Pasa a motores de video para renderizar, comparar y piloter tus flujos de movimiento.'
            : 'Jump to the video hub for rendering, compare pages, and motion workflows.',
      engines: ['seedance-2-0', 'kling-3-pro', 'veo-3-1'],
      icon: Film,
    },
    {
      title: activeLocale === 'fr' ? "Modèles d'image" : activeLocale === 'es' ? 'Modelos de imagen' : 'Image models',
      description:
        activeLocale === 'fr'
          ? "Ouvrez le hub image pour les images fixes, les retouches et les workflows guidés par références."
          : activeLocale === 'es'
            ? 'Abre el hub de imagen para imágenes fijas, ediciones y flujos guiados por referencias.'
            : 'Open the image hub for stills, edits, and reference-led workflows.',
      engines: ['seedream', 'gpt-image-2', 'nano-banana-2'],
      icon: Clapperboard,
    },
    {
      title: activeLocale === 'fr' ? 'Limites et formats' : activeLocale === 'es' ? 'Límites y formatos' : 'Limits and formats',
      description:
        activeLocale === 'fr'
          ? 'Contrôlez durée, résolution, audio, références et formats de sortie par modèle.'
          : activeLocale === 'es'
            ? 'Controla duración, resolución, audio, referencias y formatos de salida por modelo.'
            : 'Check duration, resolution, audio, references, and output format constraints by model.',
      engines: ['seedance-2-0', 'veo-3-1', 'nano-banana-2'],
      icon: Sparkles,
    },
    {
      title: activeLocale === 'fr' ? 'Prix par workflow' : activeLocale === 'es' ? 'Precio por workflow' : 'Pricing by workflow',
      description:
        activeLocale === 'fr'
          ? 'Séparez les modèles facturés à la seconde des modèles facturés à l’image.'
          : activeLocale === 'es'
            ? 'Separa motores cobrados por segundo de modelos cobrados por imagen.'
            : 'Separate per-second video engines from per-image still models.',
      engines: ['seedance-2-0', 'ltx-2-3-fast', 'nano-banana-2'],
      icon: Wand2,
    },
    {
      title: activeLocale === 'fr' ? 'Références et prompts' : activeLocale === 'es' ? 'Referencias y prompts' : 'References and prompts',
      description:
        activeLocale === 'fr'
          ? 'Ouvrez les fiches modèle pour les prompts, limitations et conseils opérationnels.'
          : activeLocale === 'es'
            ? 'Abre las fichas de modelo para prompts, limitaciones y consejos operativos.'
            : 'Open model profiles for prompts, limitations, and operational guidance.',
      engines: ['seedance-2-0', 'kling-3-pro', 'nano-banana-2'],
      icon: Copy,
    },
  ];
}

export function buildModelsFaqItems({
  listingFaq,
  scope,
}: {
  listingFaq?: Array<{ question?: string; answer?: string }>;
  scope: ModelsPageScope;
}): ModelsFaqItem[] {
  if (scope === 'all' && listingFaq?.length && listingFaq.every((item) => item.question && item.answer)) {
    return listingFaq as ModelsFaqItem[];
  }
  return FALLBACK_FAQ_ITEMS_BY_SCOPE[scope];
}

export function buildModelsReliabilityItems({
  listingItems,
  scope,
}: {
  listingItems?: Array<{ title?: string; body?: string }>;
  scope: ModelsPageScope;
}): ModelsReliabilityItem[] {
  const source =
    scope === 'all' && listingItems?.length === 3
      ? (listingItems as Array<{ title: string; body: string }>)
      : FALLBACK_RELIABILITY_ITEMS_BY_SCOPE[scope];
  return source.map((item, index) => ({
    ...item,
    icon: RELIABILITY_ICONS[index] ?? Wallet,
  }));
}

const RELIABILITY_ICONS = [Wallet, Clapperboard, Copy] as const;

const FALLBACK_FAQ_ITEMS_BY_SCOPE: Record<ModelsPageScope, ModelsFaqItem[]> = {
  all: [
    {
      question: 'Should I start from the video hub or the image hub?',
      answer:
        'Use the video hub for motion workflows and compare pages. Use the image hub for still generation, edits, reference limits, and per-image pricing.',
    },
    {
      question: 'Are all models in this catalog video models?',
      answer:
        'No. The catalog now includes both video and image models, and future media categories can be separated through dedicated hubs.',
    },
    {
      question: 'How should I interpret pricing on this page?',
      answer:
        'Video models are generally priced per second, while still-image models are priced per image or output size. Open the model page for the exact billing pattern.',
    },
    {
      question: 'Where should I compare video engines side by side?',
      answer:
        'Use the video compare hub for side-by-side comparisons. Image models currently use the dedicated model pages rather than the compare hub.',
    },
  ],
  video: [
    {
      question: 'Which models support image-to-video?',
      answer:
        'Use the model cards and filters to see which engines support image-to-video inputs and reference-based modes.',
    },
    {
      question: 'Which models support video-to-video workflows?',
      answer:
        'Video-to-video and continuation support differ by model and mode. Check each card for the exact capabilities before running production jobs.',
    },
    {
      question: 'What are the typical limits by model?',
      answer:
        'Duration, resolution, audio support, and available formats vary by provider and mode. The catalog shows the latest known limits per model.',
    },
    {
      question: 'How is pricing calculated per model and mode?',
      answer:
        'Pricing is based on model, mode, duration, resolution, and optional add-ons. Use model-level pricing signals as planning inputs before launch.',
    },
    {
      question: 'Where can I see real outputs per model?',
      answer:
        'Use the examples gallery to inspect outputs, prompts, and settings tied to each model before choosing presets for production.',
    },
    {
      question: 'How often are limits and prices updated?',
      answer:
        'Limits and pricing references are refreshed as providers update their capabilities and as new model versions are validated in production.',
    },
  ],
  image: [
    {
      question: 'Which image models support editing existing references?',
      answer:
        'Use the model cards and detail pages to check which still-image models support edit workflows, how many references they accept, and what output controls they expose.',
    },
    {
      question: 'How should I compare per-image pricing?',
      answer:
        'Compare resolution tiers, batch size limits, and optional add-ons such as web grounding or output format controls on each model page.',
    },
    {
      question: 'What limits matter most for still-image models?',
      answer:
        'The main constraints are reference count, output count per request, supported resolutions, aspect ratios, and optional advanced controls.',
    },
    {
      question: 'Why is there no image compare hub yet?',
      answer:
        'Image models currently use dedicated detail pages rather than a side-by-side compare hub. The model pages carry the most accurate workflow and pricing context.',
    },
  ],
};

const FALLBACK_RELIABILITY_ITEMS_BY_SCOPE: Record<ModelsPageScope, Array<{ title: string; body: string }>> = {
  all: [
    { title: 'Media type', body: 'Separate video engines from still-image models before evaluating specs or cost.' },
    { title: 'Limits and formats', body: 'Check duration, resolution, references, audio, and output format constraints.' },
    { title: 'Pricing model', body: 'Review whether pricing is per second, per image, by resolution, or add-on driven.' },
  ],
  video: [
    { title: 'Input type support', body: 'See text-to-video, image-to-video, and edit capabilities by model.' },
    { title: 'Limits and formats', body: 'Check max duration, resolution, audio, and format constraints.' },
    { title: 'Pricing signals', body: 'Review model-level price ranges before running full batches.' },
  ],
  image: [
    { title: 'Create vs edit support', body: 'Check which models support pure prompt generation versus reference-led edit workflows.' },
    { title: 'Reference and output limits', body: 'Verify max references, outputs per request, resolution tiers, and output controls.' },
    { title: 'Per-image pricing', body: 'Review price per image, resolution multipliers, and optional request-level add-ons.' },
  ],
};
