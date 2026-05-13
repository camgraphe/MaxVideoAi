import {
  AudioLines,
  BadgeCheck,
  Clock3,
  ExternalLink,
  FileText,
  Film,
  ImageIcon,
  Lightbulb,
  Link2,
  Maximize2,
  PenLine,
  Sparkles,
  Type,
  Volume2,
  type LucideIcon,
} from 'lucide-react';

import type { AppLocale } from '@/i18n/locales';
import { UIIcon } from '@/components/ui/UIIcon';
import { getImageAlt } from '@/lib/image-alt';

import { MODEL_PAGE_ICON, MODEL_PAGE_ICON_MUTED, MODEL_PAGE_ICON_WRAP } from '../_lib/model-page-icon-styles';
import type { FeaturedMedia } from '../_lib/model-page-media';
import { SECTION_SCROLL_MARGIN, type SoraCopy } from '../_lib/model-page-specs';
import { ModelDecisionCopyButton } from './ModelDecisionCopyButton.client';
import { ModelDecisionDemoMedia } from './ModelDecisionDemoMedia.client';
import { ModelDecisionPromptTabs } from './ModelDecisionPromptTabs.client';

type ModelDecisionPromptingSectionProps = {
  imageAnchorId: string;
  copy: SoraCopy;
  demoMedia: FeaturedMedia | null;
  engineSlug: string;
  isImageEngine: boolean;
  locale: AppLocale;
  modelName: string;
  referenceWorkflows: Array<{ title: string; body: string }>;
};

const REFERENCE_ICONS = [FileText, ImageIcon, Film, AudioLines, Link2] as const satisfies readonly LucideIcon[];

function getPromptLabels(locale: AppLocale, modelName: string) {
  if (locale === 'fr') {
    return {
      tipPrefix: 'Astuce',
      guide: `Guide officiel ${modelName}`,
      global: 'Principes globaux',
      quirks: 'Points moteur à surveiller',
      demoSubject: 'Sujet',
      demoAction: 'Action',
      demoCamera: 'Caméra',
      demoStyle: 'Style',
      demoAudio: 'Audio',
      viewFull: 'Voir le rendu complet',
      showPrompt: 'Voir le prompt complet',
      copyPrompt: 'Copier le prompt',
      copied: 'Copié',
      imageExamplesTitle: `Prompts image ${modelName}`,
      imageExamplesIntro: 'Exemples adaptés aux stills campagne, typographie, retouches et finales 4K.',
      openImageWorkspace: 'Ouvrir l’espace image',
      textToVideo: 'Texte-vers-vidéo',
      audioOn: 'Audio activé',
      referencesTitle: `Comment ${modelName} utilise les références`,
    };
  }
  if (locale === 'es') {
    return {
      tipPrefix: 'Consejo',
      guide: `Guía oficial ${modelName}`,
      global: 'Principios globales',
      quirks: 'Puntos del motor a vigilar',
      demoSubject: 'Sujeto',
      demoAction: 'Acción',
      demoCamera: 'Cámara',
      demoStyle: 'Estilo',
      demoAudio: 'Audio',
      viewFull: 'Ver resultado completo',
      showPrompt: 'Ver prompt completo',
      copyPrompt: 'Copiar prompt',
      copied: 'Copiado',
      imageExamplesTitle: `Prompts de imagen de ${modelName}`,
      imageExamplesIntro: 'Ejemplos para stills de campaña, tipografía, ediciones con referencia y finales 4K.',
      openImageWorkspace: 'Abrir espacio de imagen',
      textToVideo: 'Texto a video',
      audioOn: 'Audio activado',
      referencesTitle: `Cómo ${modelName} usa referencias`,
    };
  }
  return {
    tipPrefix: 'Tip',
    guide: `Official ${modelName} guide`,
    global: 'Global principles',
    quirks: 'Engine quirks / what to watch for',
    demoSubject: 'Subject',
    demoAction: 'Action',
    demoCamera: 'Camera',
    demoStyle: 'Style',
    demoAudio: 'Audio',
    viewFull: 'View full render',
    showPrompt: 'View full prompt',
    copyPrompt: 'Copy prompt',
    copied: 'Copied',
    imageExamplesTitle: `${modelName} image prompt examples`,
    imageExamplesIntro: 'Use these for campaign stills, typography posters, reference edits and 2K-to-4K finals.',
    openImageWorkspace: 'Open image workspace',
    textToVideo: 'Text-to-video',
    audioOn: 'Audio on',
    referencesTitle: `How ${modelName} uses references`,
  };
}

function getDemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Biker crâne blindé',
      action: 'La moto approche et marque l’arrêt',
      camera: 'Tracking bas frontal, léger push-in',
      style: 'Cinématique, reflets de rue mouillée',
      audio: 'Moteur, cliquetis métal, tonnerre lointain',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Biker calavera blindado',
      action: 'La moto se acerca y se detiene',
      camera: 'Tracking bajo frontal, leve push-in',
      style: 'Cinemático, reflejos de calle mojada',
      audio: 'Motor, metal, trueno distante',
    };
  }
  return {
    subject: 'Armored skull biker',
    action: 'Motorcycle approaches and stops',
    camera: 'Low front tracking, slight push-in',
    style: 'Cinematic, wet street reflections',
    audio: 'Engine revs, metal clinks, distant thunder',
  };
}

function getDuration(media: FeaturedMedia | null, locale: AppLocale) {
  const seconds = media?.durationSec ?? 12;
  return locale === 'fr' || locale === 'es' ? `${seconds} s` : `${seconds}s`;
}

function getAspect(media: FeaturedMedia | null) {
  return media?.aspectRatio && /^\d+:\d+$/.test(media.aspectRatio) ? media.aspectRatio : '16:9';
}

function getImagePromptExamples(locale: AppLocale, engineSlug: string) {
  if (engineSlug === 'nano-banana-2') {
    if (locale === 'fr') {
      return [
        {
          title: 'Scène produit guidée',
          badge: '1K grounded',
          icon: Sparkles,
          prompt:
            'Still produit 1K pour une gourde outdoor sur pierre claire, lumière naturelle, style campagne e-commerce premium, contexte visuel actuel de randonnée urbaine si le grounding web est activé.',
        },
        {
          title: 'Edit produit',
          badge: 'Image edit',
          icon: PenLine,
          prompt:
            'À partir de cette référence produit, garder la forme, le logo, la couleur principale et les proportions. Changer le décor en studio minéral clair, nettoyer reflets et poussières.',
        },
        {
          title: 'Multi-références',
          badge: '14 refs max',
          icon: ImageIcon,
          prompt:
            'Combiner les références en un still cohérent : référence 1 pour identité produit, référence 2 pour matière, référence 3 pour palette, référence 4 pour composition. Ne pas mélanger les styles.',
        },
        {
          title: 'Still large 4K',
          badge: '4K · 21:9',
          icon: Maximize2,
          prompt:
            'Still 4K en ratio 21:9 pour bannière de lancement, produit à gauche, espace négatif à droite pour texte ajouté ensuite, lumière douce, rendu photo réaliste.',
        },
      ];
    }
    if (locale === 'es') {
      return [
        {
          title: 'Escena de producto guiada',
          badge: '1K grounded',
          icon: Sparkles,
          prompt:
            'Still de producto 1K para una botella outdoor sobre piedra clara, luz natural, estilo campaña e-commerce premium, contexto visual actual de trekking urbano si web grounding está activo.',
        },
        {
          title: 'Edit de producto',
          badge: 'Image edit',
          icon: PenLine,
          prompt:
            'Usando esta referencia de producto, mantener forma, logo, color principal y proporciones. Cambiar el entorno a estudio mineral claro, limpiar reflejos y polvo.',
        },
        {
          title: 'Multi-referencias',
          badge: '14 refs max',
          icon: ImageIcon,
          prompt:
            'Combinar las referencias en un still coherente: referencia 1 para identidad del producto, referencia 2 para material, referencia 3 para paleta, referencia 4 para composición. No mezclar estilos.',
        },
        {
          title: 'Still amplio 4K',
          badge: '4K · 21:9',
          icon: Maximize2,
          prompt:
            'Still 4K en ratio 21:9 para banner de lanzamiento, producto a la izquierda, espacio negativo a la derecha para texto añadido después, luz suave, resultado fotorealista.',
        },
      ];
    }
    return [
      {
        title: 'Grounded product scene',
        badge: '1K grounded',
        icon: Sparkles,
        prompt:
          '1K product still for an outdoor water bottle on pale stone, natural daylight, premium e-commerce campaign style, current urban hiking context if web grounding is enabled.',
      },
      {
        title: 'Product edit',
        badge: 'Image edit',
        icon: PenLine,
        prompt:
          'Using this product reference, keep the shape, logo, main color and proportions. Change the environment to a light mineral studio, clean reflections and remove dust.',
      },
      {
        title: 'Multi-reference edit',
        badge: '14 refs max',
        icon: ImageIcon,
        prompt:
          'Combine the references into one cohesive still: reference 1 for product identity, reference 2 for material, reference 3 for palette, reference 4 for composition. Do not blend competing styles.',
      },
      {
        title: 'Wide-ratio 4K still',
        badge: '4K · 21:9',
        icon: Maximize2,
        prompt:
          '4K still in 21:9 for a launch banner, product on the left, negative space on the right for text added later, soft light, photorealistic finish.',
      },
    ];
  }
  if (locale === 'fr') {
    return [
      {
        title: 'Visuel campagne',
        badge: '2K still',
        icon: Sparkles,
        prompt:
          'Still campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.',
      },
      {
        title: 'Poster typographique',
        badge: 'Typographie',
        icon: Type,
        prompt:
          'Poster vertical 4K, grille éditoriale premium, fond graphite, grand titre exact "MIDNIGHT LAUNCH", sous-titre "LIMITED DROP", hiérarchie nette, marges généreuses, texte lisible.',
      },
      {
        title: 'Retouche référence',
        badge: 'Image-to-image',
        icon: PenLine,
        prompt:
          'À partir de cette référence produit, garder la forme, le logo et les proportions. Changer le décor en studio bleu nuit, améliorer les reflets, retirer poussières et traces.',
      },
      {
        title: '2K vers 4K final',
        badge: 'Final 4K',
        icon: Maximize2,
        prompt:
          'Reprendre la composition validée en 2K. Sortie 4K finale, détails plus nets, typographie identique, mêmes couleurs de marque, conserver cadrage et placement du produit.',
      },
    ];
  }
  if (locale === 'es') {
    return [
      {
        title: 'Still de campaña',
        badge: 'Still 2K',
        icon: Sparkles,
        prompt:
          'Still de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.',
      },
      {
        title: 'Póster tipográfico',
        badge: 'Tipografía',
        icon: Type,
        prompt:
          'Póster vertical 4K, grilla editorial premium, fondo grafito, título exacto grande "MIDNIGHT LAUNCH", subtítulo "LIMITED DROP", jerarquía clara, márgenes amplios, texto legible.',
      },
      {
        title: 'Edición con referencia',
        badge: 'Image-to-image',
        icon: PenLine,
        prompt:
          'Usando esta referencia de producto, mantener forma, logo y proporciones. Cambiar el entorno a estudio azul noche, mejorar reflejos, quitar polvo y marcas.',
      },
      {
        title: '2K a final 4K',
        badge: 'Final 4K',
        icon: Maximize2,
        prompt:
          'Reutilizar la composición aprobada en 2K. Salida final 4K, detalles más nítidos, tipografía idéntica, mismos colores de marca, mantener encuadre y posición del producto.',
      },
    ];
  }
  return [
    {
      title: 'Campaign still',
      badge: '2K still',
      icon: Sparkles,
      prompt:
        '2K campaign still for an amber perfume bottle on white acrylic, soft studio key light, clean shadow, exact headline "AURA NOIRE" top-left, small logo lockup bottom edge.',
    },
    {
      title: 'Typography poster',
      badge: 'Typography',
      icon: Type,
      prompt:
        'Vertical 4K poster, premium editorial grid, graphite background, exact headline "MIDNIGHT LAUNCH", subhead "LIMITED DROP", crisp hierarchy, generous margins, readable text.',
    },
    {
      title: 'Reference edit',
      badge: 'Image-to-image',
      icon: PenLine,
      prompt:
        'Using this product reference, keep the shape, logo and proportions. Change the scene to a midnight-blue studio, improve reflections, remove dust and fingerprints.',
    },
    {
      title: '2K to 4K final',
      badge: '4K final',
      icon: Maximize2,
      prompt:
        'Rerun the approved 2K composition as a 4K final. Sharpen fine details, keep typography identical, preserve brand colors, product position and the locked framing.',
    },
  ];
}

export function ModelDecisionPromptingSection({
  imageAnchorId,
  copy,
  demoMedia,
  engineSlug,
  isImageEngine,
  locale,
  modelName,
  referenceWorkflows,
}: ModelDecisionPromptingSectionProps) {
  const labels = getPromptLabels(locale, modelName);
  const demo = getDemoSummary(locale);
  const title = copy.promptingTitle ?? `Prompt Lab — ${modelName}`;
  const intro = copy.promptingIntro ?? '';
  const imageExamplesIntro =
    engineSlug === 'nano-banana-2'
      ? locale === 'fr'
        ? 'Exemples pour stills guidés, edits produit, multi-références et formats larges 4K.'
        : locale === 'es'
          ? 'Ejemplos para stills guiados, edits de producto, multi-referencias y formatos amplios 4K.'
          : 'Use these for grounded stills, product edits, multi-reference workflows and wide-ratio 4K images.'
      : labels.imageExamplesIntro;
  const guideLabel = labels.guide;
  const guideHref = copy.promptingGuideUrl ?? null;
  const posterSrc = demoMedia?.posterUrl ?? null;
  const demoVideoSrc = demoMedia?.videoUrl ?? demoMedia?.previewVideoUrl ?? null;
  const demoPromptText =
    demoMedia?.prompt ??
    [
      `${labels.demoSubject}: ${demo.subject}`,
      `${labels.demoAction}: ${demo.action}`,
      `${labels.demoCamera}: ${demo.camera}`,
      `${labels.demoStyle}: ${demo.style}`,
      `${labels.demoAudio}: ${demo.audio}`,
    ].join('\n');
  const demoAlt = getImageAlt({
    kind: 'renderThumb',
    engine: modelName,
    label: copy.demoTitle ?? `${modelName} demo render`,
    prompt: copy.demoTitle ?? `${modelName} demo render`,
    locale,
  });

  return (
    <section id={imageAnchorId} className={`${SECTION_SCROLL_MARGIN} space-y-4`}>
      <div className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:bg-slate-950/72 dark:shadow-[0_24px_70px_-42px_rgba(0,0,0,0.85)] sm:p-7">
        <div className="mx-auto max-w-4xl text-center">
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <h2 className="text-[2rem] font-semibold leading-tight tracking-normal text-slate-950 dark:text-white sm:text-[2.45rem]">
              {title}
            </h2>
            {guideHref ? (
              <a
                href={guideHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-blue-50 px-4 text-xs font-semibold uppercase tracking-[0.06em] text-blue-600 dark:bg-blue-500/12 dark:text-blue-200"
              >
                <span>{guideLabel}</span>
                <UIIcon icon={ExternalLink} size={12} className={MODEL_PAGE_ICON_MUTED} />
              </a>
            ) : null}
          </div>
          {intro ? <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{intro}</p> : null}
          {copy.promptingTip ? (
            <div className="mx-auto mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50/90 px-5 py-2 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
              <UIIcon icon={Lightbulb} size={15} className="text-slate-500 dark:text-slate-300" />
              <span>{copy.promptingTip.replace(/^Tip:\s*/i, `${labels.tipPrefix}: `)}</span>
            </div>
          ) : null}
        </div>

        {referenceWorkflows.length ? (
          <div className="mt-6 rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <h3 className="!text-left text-base font-semibold text-slate-950 dark:text-white">{labels.referencesTitle}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
              {referenceWorkflows.map((workflow, index) => {
                const Icon = REFERENCE_ICONS[index] ?? Sparkles;
                return (
                  <article key={workflow.title} className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-slate-950/56 sm:p-4">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full sm:h-9 sm:w-9 ${MODEL_PAGE_ICON_WRAP}`}>
                      <UIIcon icon={Icon} size={17} className={MODEL_PAGE_ICON} />
                    </span>
                    <h4 className="mt-3 !text-left text-[0.82rem] font-semibold leading-snug text-slate-950 dark:text-white sm:text-sm">{workflow.title}</h4>
                    <p className="mt-1 text-[0.74rem] leading-4 text-slate-600 dark:text-slate-300 sm:text-[0.8rem] sm:leading-5">{workflow.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
          <ModelDecisionPromptTabs
            tabs={copy.promptingTabs}
            locale={locale}
            exampleHref={demoMedia?.href ?? null}
            engineSlug={engineSlug}
            isImageEngine={isImageEngine}
          />

          <div className="space-y-4 lg:pt-14">
            <article className="rounded-[20px] border border-hairline bg-surface p-4 shadow-[0_18px_54px_-38px_rgba(15,23,42,0.42)] dark:bg-white/[0.045]">
              <div className="mb-3 flex items-center gap-3">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${MODEL_PAGE_ICON_WRAP}`}>
                  <UIIcon icon={BadgeCheck} size={19} className={MODEL_PAGE_ICON} />
                </span>
                <h3 className="!text-left text-base font-semibold text-text-primary">{labels.global}</h3>
              </div>
              <ul className="space-y-2.5 text-[0.84rem] leading-5 text-text-secondary">
                {copy.promptingGlobalPrinciples.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <UIIcon icon={BadgeCheck} size={15} className={`mt-0.5 shrink-0 ${MODEL_PAGE_ICON_MUTED}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-[20px] border border-hairline bg-surface p-4 shadow-[0_18px_54px_-38px_rgba(15,23,42,0.42)] dark:bg-white/[0.045]">
              <div className="mb-3 flex items-center gap-3">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${MODEL_PAGE_ICON_WRAP}`}>
                  <UIIcon icon={Sparkles} size={19} className={MODEL_PAGE_ICON} />
                </span>
                <h3 className="!text-left text-base font-semibold text-text-primary">{labels.quirks}</h3>
              </div>
              <ul className="space-y-2.5 text-[0.84rem] leading-5 text-text-secondary">
                {copy.promptingEngineWhy.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <UIIcon icon={BadgeCheck} size={15} className={`mt-0.5 shrink-0 ${MODEL_PAGE_ICON_MUTED}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </div>

      {isImageEngine ? (
        <article className="rounded-[22px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:bg-slate-950/72">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="!text-left text-2xl font-semibold text-text-primary">{labels.imageExamplesTitle}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{imageExamplesIntro}</p>
            </div>
            <a
              href={`/app/image?engine=${encodeURIComponent(engineSlug)}`}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-2"
            >
              <UIIcon icon={Sparkles} size={15} />
              <span>{labels.openImageWorkspace}</span>
            </a>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {getImagePromptExamples(locale, engineSlug).map((example) => {
              const Icon = example.icon;
              return (
                <article key={example.title} className="rounded-xl border border-hairline bg-surface p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${MODEL_PAGE_ICON_WRAP}`}>
                      <UIIcon icon={Icon} size={18} className={MODEL_PAGE_ICON} />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="!text-left text-base font-semibold text-text-primary">{example.title}</h3>
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[0.68rem] font-semibold text-blue-700 dark:bg-blue-500/12 dark:text-blue-200">
                          {example.badge}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-text-secondary">{example.prompt}</p>
                      <div className="mt-3">
                        <ModelDecisionCopyButton copyText={example.prompt} label={labels.copyPrompt} copiedLabel={labels.copied} />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </article>
      ) : (
      <article className="grid gap-5 rounded-[22px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:bg-slate-950/72 lg:grid-cols-[minmax(0,0.86fr)_minmax(440px,1.14fr)]">
        <div>
          <h2 className="!text-left text-2xl font-semibold text-text-primary">{copy.demoTitle ?? `Demo prompt — ${modelName}`}</h2>
          <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 dark:bg-blue-500/12 dark:text-blue-200">
            {labels.textToVideo}
          </span>
          <p className="mt-4 text-sm leading-6 text-text-secondary">
            <strong>{labels.demoSubject}:</strong> {demo.subject} &nbsp;•&nbsp; <strong>{labels.demoAction}:</strong> {demo.action}
            <br />
            <strong>{labels.demoCamera}:</strong> {demo.camera} &nbsp;•&nbsp; <strong>{labels.demoStyle}:</strong> {demo.style}
            <br />
            <strong>{labels.demoAudio}:</strong> {demo.audio}
          </p>
          <details className="mt-5 rounded-xl border border-hairline bg-surface p-4 text-sm text-text-secondary shadow-sm">
            <summary className="cursor-pointer font-semibold text-text-primary">{labels.showPrompt}</summary>
            <pre className="mt-3 max-h-[180px] overflow-auto whitespace-pre-wrap rounded-lg border border-hairline bg-bg px-3 py-3 font-mono text-[0.8rem] leading-5 text-text-primary dark:bg-slate-950/72">
              {demoPromptText}
            </pre>
            <div className="mt-3">
              <ModelDecisionCopyButton copyText={demoPromptText} label={labels.copyPrompt} copiedLabel={labels.copied} />
            </div>
          </details>
          <div className="mt-5 flex flex-wrap gap-3">
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-secondary">
              <UIIcon icon={Clock3} size={15} />
              {getDuration(demoMedia, locale)}
            </span>
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-secondary">
              <UIIcon icon={Sparkles} size={15} />
              {getAspect(demoMedia)}
            </span>
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-secondary">
              <UIIcon icon={Volume2} size={15} className={MODEL_PAGE_ICON_MUTED} />
              {labels.audioOn}
            </span>
          </div>
        </div>

        <ModelDecisionDemoMedia
          posterSrc={posterSrc}
          videoSrc={demoVideoSrc}
          alt={demoAlt}
          durationLabel={getDuration(demoMedia, locale)}
          aspectLabel={getAspect(demoMedia)}
          renderHref={demoMedia?.href ?? null}
          renderLabel={labels.viewFull}
        />
      </article>
      )}
    </section>
  );
}
