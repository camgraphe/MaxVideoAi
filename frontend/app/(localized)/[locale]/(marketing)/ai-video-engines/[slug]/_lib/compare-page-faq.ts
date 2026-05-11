import type { AppLocale } from '@/i18n/locales';
import type { ComparePageCopy } from './compare-page-copy';
import type { ComparePageOverride } from './compare-page-overrides';
import type { ComparePricingDisplay, CompareSpecValues, EngineCatalogEntry } from './compare-page-types';
import {
  formatEngineName,
  formatTemplate,
  isPending,
  localizeSpecDetailValue,
  pickFirstCapabilityDifference,
  pickOutputDifference,
  stripAudioReferencesForSilentPair,
} from './compare-page-helpers';

export type CompareFaqItem = {
  question: string;
  answer: string | string[];
};

type CompareStatusLabels = {
  pending: string;
  supported: string;
  notSupported: string;
};

export function formatCompareFaqValue(
  value: string,
  locale: AppLocale,
  labels: CompareStatusLabels,
  validatingLabel: string
) {
  return isPending(value) ? validatingLabel : localizeSpecDetailValue(value, locale, labels);
}

export function buildCompareFaqItems({
  activeLocale,
  compareCopy,
  labels,
  left,
  right,
  leftPricingDisplay,
  rightPricingDisplay,
  leftSpecs,
  rightSpecs,
  pageOverride,
  pairHasKling3Native4k,
  pairHasNativeAudio,
  specLabels,
}: {
  activeLocale: AppLocale;
  compareCopy: ComparePageCopy;
  labels: CompareStatusLabels;
  left: EngineCatalogEntry;
  right: EngineCatalogEntry;
  leftPricingDisplay: ComparePricingDisplay;
  rightPricingDisplay: ComparePricingDisplay;
  leftSpecs: CompareSpecValues;
  rightSpecs: CompareSpecValues;
  pageOverride?: ComparePageOverride | null;
  pairHasKling3Native4k: boolean;
  pairHasNativeAudio: boolean;
  specLabels: Record<string, string>;
}): CompareFaqItem[] {
  if (pageOverride?.faq?.items) {
    return pageOverride.faq.items;
  }

  const validatingLabel = compareCopy.faq?.validating ?? 'still being validated';
  const formatFaqValue = (value: string) => formatCompareFaqValue(value, activeLocale, labels, validatingLabel);
  const faqPricingLeft = formatFaqValue(leftPricingDisplay.headline);
  const faqPricingRight = formatFaqValue(rightPricingDisplay.headline);
  const faqT2vLeft = formatFaqValue(leftSpecs.textToVideo);
  const faqT2vRight = formatFaqValue(rightSpecs.textToVideo);
  const faqI2vLeft = formatFaqValue(leftSpecs.imageToVideo);
  const faqI2vRight = formatFaqValue(rightSpecs.imageToVideo);
  const faqV2vLeft = formatFaqValue(leftSpecs.videoToVideo);
  const faqV2vRight = formatFaqValue(rightSpecs.videoToVideo);
  const faqFirstLastLeft = formatFaqValue(leftSpecs.firstLastFrame);
  const faqFirstLastRight = formatFaqValue(rightSpecs.firstLastFrame);
  const faqRefImgLeft = formatFaqValue(leftSpecs.referenceImageStyle);
  const faqRefImgRight = formatFaqValue(rightSpecs.referenceImageStyle);
  const faqRefVidLeft = formatFaqValue(leftSpecs.referenceVideo);
  const faqRefVidRight = formatFaqValue(rightSpecs.referenceVideo);
  const faqResLeft = formatFaqValue(leftSpecs.maxResolution);
  const faqResRight = formatFaqValue(rightSpecs.maxResolution);
  const faqDurLeft = formatFaqValue(leftSpecs.maxDuration);
  const faqDurRight = formatFaqValue(rightSpecs.maxDuration);
  const faqArLeft = formatFaqValue(leftSpecs.aspectRatios);
  const faqArRight = formatFaqValue(rightSpecs.aspectRatios);
  const faqAudioOutLeft = formatFaqValue(leftSpecs.audioOutput);
  const faqAudioOutRight = formatFaqValue(rightSpecs.audioOutput);
  const faqAudioGenLeft = formatFaqValue(leftSpecs.nativeAudioGeneration);
  const faqAudioGenRight = formatFaqValue(rightSpecs.nativeAudioGeneration);
  const faqLipLeft = formatFaqValue(leftSpecs.lipSync);
  const faqLipRight = formatFaqValue(rightSpecs.lipSync);
  const capabilityTemplates = {
    value:
      compareCopy.faq?.capabilityDiff ??
      '{label}: {left} is {leftValue} vs {right} is {rightValue}.',
    pending:
      compareCopy.faq?.capabilityPending ??
      '{label}: both are {status}.',
  };
  const outputTemplates = {
    value:
      compareCopy.faq?.outputDiff ??
      '{label}: {left} is {leftValue} vs {right} is {rightValue}.',
    pending:
      compareCopy.faq?.outputPending ??
      '{label}: data is still being validated for one or both engines.',
  };
  const faqCapabilityDiff = pickFirstCapabilityDifference(
    left,
    right,
    [
      { label: specLabels.lipSync ?? 'Lip sync', leftStatus: faqLipLeft, rightStatus: faqLipRight },
      {
        label: specLabels.nativeAudioGeneration ?? 'Native audio generation',
        leftStatus: faqAudioGenLeft,
        rightStatus: faqAudioGenRight,
      },
      {
        label: specLabels.firstLastFrame ?? 'First/Last frame',
        leftStatus: faqFirstLastLeft,
        rightStatus: faqFirstLastRight,
      },
      {
        label: specLabels.referenceImageStyle ?? 'Reference image / style reference',
        leftStatus: faqRefImgLeft,
        rightStatus: faqRefImgRight,
      },
      { label: specLabels.referenceVideo ?? 'Reference video', leftStatus: faqRefVidLeft, rightStatus: faqRefVidRight },
      { label: specLabels.videoToVideo ?? 'Video-to-Video', leftStatus: faqV2vLeft, rightStatus: faqV2vRight },
      { label: specLabels.imageToVideo ?? 'Image-to-Video', leftStatus: faqI2vLeft, rightStatus: faqI2vRight },
      { label: specLabels.textToVideo ?? 'Text-to-Video', leftStatus: faqT2vLeft, rightStatus: faqT2vRight },
    ],
    capabilityTemplates,
    validatingLabel,
    activeLocale
  );
  const faqOutputDiff = pickOutputDifference(
    formatEngineName(left),
    formatEngineName(right),
    faqResLeft,
    faqResRight,
    compareCopy.faq?.outputLabel ?? 'Max resolution',
    outputTemplates,
    validatingLabel
  );
  const faqTemplates = compareCopy.faq ?? {};
  const kling3Native4kFaqCopy = pairHasKling3Native4k
    ? activeLocale === 'fr'
      ? {
          a1: '{left} et {right} sont des modèles de génération vidéo IA disponibles sur MaxVideoAI. Cette page compare la livraison 4K native, le coût d’itération, les caractéristiques clés et les données ci-dessus.',
          a2: 'Cela dépend du flux de production. Utilisez la grille de scores et les caractéristiques pour décider si le plan a besoin d’une livraison 4K native ou d’une route d’itération moins coûteuse, puis ouvrez chaque profil pour les détails complets.',
          q10: 'Pourquoi les résultats peuvent-ils différer entre ces routes ?',
          a10: 'Même avec des instructions proches, les modèles interprètent différemment les contraintes et les réglages. Pour Kling 3 4K, comparez d’abord les caractéristiques et l’échelle de coût, puis rendez seulement les plans finalisés en 4K native.',
        }
      : activeLocale === 'es'
        ? {
            a1: '{left} y {right} son modelos de generación de video IA disponibles en MaxVideoAI. Esta página compara entrega 4K nativa, precio de iteración, especificaciones clave y los datos anteriores.',
            a2: 'Depende de tu flujo de trabajo. Usa el scorecard y las especificaciones para decidir si el plano necesita entrega 4K nativa o una ruta de iteración de menor precio, luego abre cada perfil para los detalles completos.',
            q10: '¿Por qué pueden diferir los resultados entre estas rutas?',
            a10: 'Incluso con instrucciones similares, los modelos interpretan las restricciones y los ajustes de forma distinta. Para Kling 3 4K, compara primero las especificaciones y la escala de precio, luego renderiza en 4K nativo solo los planos aprobados.',
          }
        : {
            a1: '{left} and {right} are AI video generation engines available on MaxVideoAI. This page compares native 4K delivery, iteration cost, key specs, and performance data shown above.',
            a2: 'It depends on your workflow. Use the scorecard and specs to decide whether the job needs native 4K delivery or a lower-cost iteration route, then open each engine profile for full details.',
            q10: 'Why can results differ between these routes?',
            a10: 'Even with similar instructions, models interpret constraints and settings differently. For Kling 3 4K, compare the specs and cost ladder first, then render only approved final shots in native 4K.',
          }
    : null;

  return [
    {
      question: formatTemplate(
        faqTemplates.q1 ?? 'What are {left} and {right}?',
        { left: formatEngineName(left), right: formatEngineName(right) }
      ),
      answer: formatTemplate(
        kling3Native4kFaqCopy?.a1 ??
          faqTemplates.a1 ??
          '{left} and {right} are AI video generation engines available on MaxVideoAI. This page compares them side-by-side using the same prompts, key specs, and performance data shown above.',
        { left: formatEngineName(left), right: formatEngineName(right) }
      ),
    },
    {
      question: formatTemplate(
        faqTemplates.q2 ?? 'Which is better: {left} or {right}?',
        { left: formatEngineName(left), right: formatEngineName(right) }
      ),
      answer:
        kling3Native4kFaqCopy?.a2 ??
        faqTemplates.a2 ??
        'It depends on your workflow. Use the scorecard and the “same prompt” showdowns to compare prompt adherence, motion realism, human fidelity, and text legibility — then open each engine profile for full details.',
    },
    {
      question: faqTemplates.q3 ?? 'Which is cheaper on MaxVideoAI?',
      answer: formatTemplate(
        stripAudioReferencesForSilentPair(
          faqTemplates.a3 ??
          (pairHasNativeAudio
            ? 'Pricing varies by engine and settings (duration, resolution, audio). Currently, {left} starts at {leftValue} and {right} starts at {rightValue} (see “Pricing (MaxVideoAI)” for details).'
            : 'Pricing varies by engine and settings (duration and resolution). Currently, {left} starts at {leftValue} and {right} starts at {rightValue} (see “Pricing (MaxVideoAI)” for details).'),
          pairHasNativeAudio
        ),
        {
          left: formatEngineName(left),
          right: formatEngineName(right),
          leftValue: faqPricingLeft,
          rightValue: faqPricingRight,
        }
      ),
    },
    {
      question: formatTemplate(
        faqTemplates.q4 ?? 'What are the biggest differences between {left} and {right}?',
        { left: formatEngineName(left), right: formatEngineName(right) }
      ),
      answer: [faqCapabilityDiff, faqOutputDiff],
    },
    {
      question:
        faqTemplates.q5 ?? 'Do they support Text-to-Video / Image-to-Video / Video-to-Video?',
      answer: formatTemplate(
        faqTemplates.a5 ??
          'On MaxVideoAI: Text-to-Video is {t2vLeft} vs {t2vRight}; Image-to-Video is {i2vLeft} vs {i2vRight}; Video-to-Video is {v2vLeft} vs {v2vRight}. Some fields may still be under validation.',
        {
          t2vLeft: faqT2vLeft,
          t2vRight: faqT2vRight,
          i2vLeft: faqI2vLeft,
          i2vRight: faqI2vRight,
          v2vLeft: faqV2vLeft,
          v2vRight: faqV2vRight,
        }
      ),
    },
    {
      question: faqTemplates.q6 ?? 'Do they support First/Last frame or references?',
      answer: formatTemplate(
        faqTemplates.a6 ??
          'First/Last frame is {firstLeft} vs {firstRight}. Reference image/style is {refImgLeft} vs {refImgRight}; Reference video is {refVidLeft} vs {refVidRight}.',
        {
          firstLeft: faqFirstLastLeft,
          firstRight: faqFirstLastRight,
          refImgLeft: faqRefImgLeft,
          refImgRight: faqRefImgRight,
          refVidLeft: faqRefVidLeft,
          refVidRight: faqRefVidRight,
        }
      ),
    },
    {
      question: faqTemplates.q7 ?? 'What are the max resolution, duration, and aspect ratios?',
      answer: formatTemplate(
        faqTemplates.a7 ??
          'Max output is {resLeft} / {durLeft} for {left} and {resRight} / {durRight} for {right}. Supported aspect ratios include {arLeft} vs {arRight} (see Key Specs for the full list).',
        {
          resLeft: faqResLeft,
          durLeft: faqDurLeft,
          left: formatEngineName(left),
          resRight: faqResRight,
          durRight: faqDurRight,
          right: formatEngineName(right),
          arLeft: faqArLeft,
          arRight: faqArRight,
        }
      ),
    },
    ...(pairHasNativeAudio
      ? [
          {
            question: faqTemplates.q8 ?? 'Do they support audio generation and lip sync?',
            answer: formatTemplate(
              faqTemplates.a8 ??
                'Audio output is {audioOutLeft} vs {audioOutRight}. Native audio generation is {audioGenLeft} vs {audioGenRight}, and lip sync is {lipLeft} vs {lipRight} (some fields may still be under validation).',
              {
                audioOutLeft: faqAudioOutLeft,
                audioOutRight: faqAudioOutRight,
                audioGenLeft: faqAudioGenLeft,
                audioGenRight: faqAudioGenRight,
                lipLeft: faqLipLeft,
                lipRight: faqLipRight,
              }
            ),
          },
        ]
      : []),
    {
      question: faqTemplates.q9 ?? 'Does MaxVideoAI add a watermark?',
      answer:
        faqTemplates.a9 ??
        'No. MaxVideoAI exports are watermark-free (“Watermark: No (MaxVideoAI)”).',
    },
    {
      question:
        kling3Native4kFaqCopy?.q10 ??
        faqTemplates.q10 ??
        'Why do results look different with the same prompt?',
      answer:
        kling3Native4kFaqCopy?.a10 ??
        faqTemplates.a10 ??
        'Even with identical prompts, models interpret instructions differently and use different training data and generation strategies. That’s why the Showdown section exists: same prompt, side-by-side outputs.',
    },
    {
      question: faqTemplates.q11 ?? 'Where can I find full specs, controls, and more prompt examples?',
      answer: formatTemplate(
        faqTemplates.a11 ??
          'Open the full engine profiles for complete specs, controls, and more prompts: /models/{leftSlug} and /models/{rightSlug}. You can also browse more outputs in the engine galleries.',
        { leftSlug: left.modelSlug, rightSlug: right.modelSlug }
      ),
    },
  ];
}

export function buildCompareFaqJsonLd(faqItems: CompareFaqItem[]) {
  const faqJsonLdItems = faqItems.filter((item) => {
    const text = Array.isArray(item.answer) ? item.answer.join(' ') : item.answer;
    return !text.toLowerCase().includes('data pending');
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqJsonLdItems.slice(0, 6).map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: Array.isArray(item.answer) ? item.answer.join(' ') : item.answer,
      },
    })),
  };
}
