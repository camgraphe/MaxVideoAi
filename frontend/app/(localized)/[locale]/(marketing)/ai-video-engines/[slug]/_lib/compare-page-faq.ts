import { compareDurationDetails, compareDurationLabels } from './compare-duration-copy';
import { comparePriceLines } from './compare-pricing-copy';
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
  hasShowdownSlots = true,
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
  hasShowdownSlots?: boolean;
}): CompareFaqItem[] {
  if (pageOverride?.faq?.items) {
    return pageOverride.faq.items;
  }

  const validatingLabel = compareCopy.faq?.validating ?? 'still being validated';
  const formatFaqValue = (value: string) => formatCompareFaqValue(value, activeLocale, labels, validatingLabel);
  const faqResLeft = formatFaqValue(leftSpecs.maxResolution);
  const faqResRight = formatFaqValue(rightSpecs.maxResolution);
  const modelFacts = (keys: Array<keyof CompareSpecValues>) => [left, right].map((entry, i) => {
    const specs = i === 0 ? leftSpecs : rightSpecs;
    return `${formatEngineName(entry)} — ${keys.map(key => `${specLabels[key] ?? key}: ${formatFaqValue(String(specs[key]))}`).join('; ')}.`;
  });
  const limits = [left, right].map((entry, i) => {
    const specs = i === 0 ? leftSpecs : rightSpecs;
    const durationCopy = compareDurationLabels(activeLocale);
    return `${formatEngineName(entry)} — ${specLabels.maxResolution}: ${formatFaqValue(specs.maxResolution)}; ${durationCopy.newClip}: ${specs.maxDuration}. ${compareDurationDetails(specs, activeLocale).join('; ')}. ${specs.extensionDuration ? `${durationCopy.extension}: ${formatFaqValue(specs.extensionDuration)}. ` : ''}${specLabels.aspectRatios}: ${specs.aspectRatios}. ${durationCopy.conditions}`;
  });
  const capabilityTemplates = {
    value: '{label} — {left}: {leftValue}; {right}: {rightValue}.',
    pending:
      compareCopy.faq?.capabilityPending ??
      '{label}: both are {status}.',
  };
  const outputTemplates = {
    shared: activeLocale === 'fr' ? '{label} : {left} et {right} proposent tous les deux {value}.' : activeLocale === 'es' ? '{label}: {left} y {right} ofrecen {value}.' : '{label}: {left} and {right} both offer {value}.',
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
      { label: specLabels.referenceImageStyle ?? 'Image references', leftStatus: leftSpecs.referenceImageStyle, rightStatus: rightSpecs.referenceImageStyle, includeDetails: true },
      { label: specLabels.videoToVideo ?? 'Source video', leftStatus: leftSpecs.videoToVideo, rightStatus: rightSpecs.videoToVideo, includeDetails: true },
      { label: specLabels.firstLastFrame ?? 'First/Last frame', leftStatus: leftSpecs.firstLastFrame, rightStatus: rightSpecs.firstLastFrame },
      { label: specLabels.nativeAudioGeneration ?? 'Native audio', leftStatus: leftSpecs.nativeAudioGeneration, rightStatus: rightSpecs.nativeAudioGeneration },
      { label: specLabels.lipSync ?? 'Lip sync', leftStatus: leftSpecs.lipSync, rightStatus: rightSpecs.lipSync },
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
          a1: '{left} et {right} sont des modèles de génération vidéo IA documentés sur MaxVideoAI. Cette page compare la livraison 4K native, le coût d’itération, les caractéristiques clés et les données ci-dessus.',
          a2: 'Cela dépend du flux de production. Utilisez la grille de scores et les caractéristiques pour décider si le plan a besoin d’une livraison 4K native ou d’une route d’itération moins coûteuse, puis ouvrez chaque profil pour les détails complets.',
          q10: 'Pourquoi les résultats peuvent-ils différer entre ces routes ?',
          a10: 'Même avec des instructions proches, les modèles interprètent différemment les contraintes et les réglages. Pour Kling 3 4K, comparez d’abord les caractéristiques et l’échelle de coût, puis rendez seulement les plans finalisés en 4K native.',
        }
      : activeLocale === 'es'
        ? {
            a1: '{left} y {right} son modelos de generación de video IA documentados en MaxVideoAI. Esta página compara entrega 4K nativa, precio de iteración, especificaciones clave y los datos anteriores.',
            a2: 'Depende de tu flujo de trabajo. Usa el scorecard y las especificaciones para decidir si el plano necesita entrega 4K nativa o una ruta de iteración de menor precio, luego abre cada perfil para los detalles completos.',
            q10: '¿Por qué pueden diferir los resultados entre estas rutas?',
            a10: 'Incluso con instrucciones similares, los modelos interpretan las restricciones y los ajustes de forma distinta. Para Kling 3 4K, compara primero las especificaciones y la escala de precio, luego renderiza en 4K nativo solo los planos aprobados.',
          }
        : {
            a1: '{left} and {right} are AI video generation engines documented on MaxVideoAI. This page compares native 4K delivery, iteration cost, key specs, and performance data shown above.',
            a2: 'It depends on your workflow. Use the scorecard and specs to decide whether the job needs native 4K delivery or a lower-cost iteration route, then open each engine profile for full details.',
            q10: 'Why can results differ between these routes?',
            a10: 'Even with similar instructions, models interpret constraints and settings differently. For Kling 3 4K, compare the specs and cost ladder first, then render only approved final shots in native 4K.',
          }
    : null;
  const noShowdownFaqCopy = !hasShowdownSlots
    ? activeLocale === 'fr'
      ? {
          a1: '{left} et {right} sont des moteurs de génération vidéo IA documentés sur MaxVideoAI. Cette page compare les specs clés, les prix, les contrôles et les données de performance ci-dessus.',
          a2: 'Cela dépend de votre workflow. Utilisez la grille de scores et les specs pour comparer le contrôle, les références, l’audio, le prix et les limites de génération, puis ouvrez chaque profil pour les détails complets.',
          q10: 'Pourquoi les résultats peuvent-ils différer entre ces modèles ?',
          a10: 'Les modèles interprètent les instructions, les références visuelles et les contraintes de génération différemment.',
        }
      : activeLocale === 'es'
        ? {
            a1: '{left} y {right} son motores de generación de video IA documentados en MaxVideoAI. Esta página compara especificaciones clave, precios, controles y los datos de rendimiento anteriores.',
            a2: 'Depende de tu flujo de trabajo. Usa la puntuación y las especificaciones para comparar control, referencias, audio, precio y límites de generación, luego abre cada perfil para los detalles completos.',
            q10: '¿Por qué pueden diferir los resultados entre estos modelos?',
            a10: 'Los modelos interpretan instrucciones, referencias visuales y restricciones de generación de forma distinta.',
          }
        : {
            a1: '{left} and {right} are AI video generation engines documented on MaxVideoAI. This page compares key specs, pricing, controls, and performance data shown above.',
            a2: 'It depends on your workflow. Use the scorecard and specs to compare control, references, audio, pricing, and generation limits, then open each engine profile for full details.',
            q10: 'Why can results differ between these models?',
            a10: 'Models interpret instructions, visual references, and generation constraints differently.',
          }
    : null;

  const items: CompareFaqItem[] = [
    {
      question: formatTemplate(
        faqTemplates.q1 ?? 'What are {left} and {right}?',
        { left: formatEngineName(left), right: formatEngineName(right) }
      ),
      answer: formatTemplate(
        kling3Native4kFaqCopy?.a1 ??
          noShowdownFaqCopy?.a1 ??
          faqTemplates.a1 ??
          '{left} and {right} are AI video generation engines documented on MaxVideoAI. This page compares them side-by-side using the same prompts, key specs, and performance data shown above.',
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
        noShowdownFaqCopy?.a2 ??
        faqTemplates.a2 ??
        'It depends on your workflow. Use the scorecard and the “same prompt” showdowns to compare prompt adherence, motion realism, human fidelity, and text legibility — then open each engine profile for full details.',
    },
    {
      question: faqTemplates.q3 ?? 'Which is cheaper on MaxVideoAI?',
      answer: [
        `${formatEngineName(left)} — ${comparePriceLines(leftPricingDisplay, activeLocale).join('; ')}.`,
        `${formatEngineName(right)} — ${comparePriceLines(rightPricingDisplay, activeLocale).join('; ')}.`,
        activeLocale === 'fr' ? 'Comparez à réglages équivalents. Ces montants sont des estimations en USD, pas des devis réservés.' : activeLocale === 'es' ? 'Compara con los mismos ajustes. Estos importes son estimaciones en USD, no presupuestos reservados.' : 'Compare equivalent settings. These are estimates in USD, not reserved quotes.',
      ],
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
      answer: modelFacts(['textToVideo', 'imageToVideo', 'videoToVideo']),
    },
    {
      question: faqTemplates.q6 ?? 'Do they support First/Last frame or references?',
      answer: modelFacts(['firstLastFrame', 'referenceImageStyle', 'referenceVideo']),
    },
    {
      question: faqTemplates.q7 ?? 'What are the max resolution, duration, and aspect ratios?',
      answer: limits,
    },
    ...(pairHasNativeAudio
      ? [
          {
            question: faqTemplates.q8 ?? 'Do they support audio generation and lip sync?',
            answer: modelFacts(['audioOutput', 'nativeAudioGeneration', 'lipSync']),
          },
        ]
      : []),
    {
      question: faqTemplates.q9 ?? 'Does MaxVideoAI add a watermark?',
      answer: modelFacts(['watermark']),
    },
    {
      question:
        kling3Native4kFaqCopy?.q10 ??
        noShowdownFaqCopy?.q10 ??
        faqTemplates.q10 ??
        'Why do results look different with the same prompt?',
      answer:
        kling3Native4kFaqCopy?.a10 ??
        noShowdownFaqCopy?.a10 ??
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
  return prioritizeCompareFaq(items, pageOverride?.quickVerdict?.body);

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


/** Keep authored FAQs untouched; lead the generated list with the buying decision. */
export function prioritizeCompareFaq(items: CompareFaqItem[], verdict?: string): CompareFaqItem[] {
  const [about, choice, ...details] = items;
  if (!choice) return items;
  return [{ ...choice, answer: verdict ?? choice.answer }, ...details, about];
}
