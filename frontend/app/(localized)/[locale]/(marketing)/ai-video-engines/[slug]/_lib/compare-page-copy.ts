import type { AppLocale } from '@/i18n/locales';
import {
  formatTemplate,
  getPrelaunchCompareNotice,
  replaceCriteriaCount,
} from './compare-page-helpers';

export type ComparePageCopy = {
  meta?: {
    title?: string;
    description?: string;
    titleFallback?: string;
    descriptionFallback?: string;
    slugOverrides?: Record<string, { title?: string; description?: string }>;
  };
  hero?: {
    back?: string;
    kicker?: string;
    intro?: string;
    introPrelaunch?: string;
    takeawaysTitle?: string;
    lastUpdatedLabel?: string;
  };
  scorecard?: {
    title?: string;
    subtitle?: string;
    provisionalNote?: string;
    strengthsLabel?: string;
    winnerSummary?: string;
    winnerSummaryPrelaunch?: string;
    generateWith?: string;
    fullProfile?: string;
  };
  labels?: {
    pending?: string;
    supported?: string;
    notSupported?: string;
    na?: string;
    prompt?: string;
    tryPrompt?: string;
    tryPromptPrelaunch?: string;
    opensGenerator?: string;
    opensGeneratorPrelaunch?: string;
    savePromptForLaunch?: string;
    whatTests?: string;
    placeholder?: string;
    copyPrompt?: string;
    copied?: string;
    expandPrompt?: string;
    collapsePrompt?: string;
  };
  keySpecs?: { title?: string; subtitle?: string; keyLabel?: string };
  specLabels?: Record<string, string>;
  showdown?: { title?: string; subtitle?: string; subtitlePrelaunch?: string; note?: string; footer?: string };
  related?: { title?: string; subtitle?: string };
  prelaunch?: { title?: string; notice?: string };
  faq?: {
    title?: string;
    subtitle?: string;
    validating?: string;
    pricingDiff?: string;
    capabilityDiff?: string;
    capabilityPending?: string;
    outputDiff?: string;
    outputPending?: string;
    capabilityLabel?: string;
    outputLabel?: string;
    q1?: string;
    a1?: string;
    q2?: string;
    a2?: string;
    q3?: string;
    a3?: string;
    q4?: string;
    a4?: string;
    q5?: string;
    a5?: string;
    q6?: string;
    a6?: string;
    q7?: string;
    a7?: string;
    q8?: string;
    a8?: string;
    q9?: string;
    a9?: string;
    q10?: string;
    a10?: string;
    q11?: string;
    a11?: string;
  };
  summary?: {
    scorecardLabel?: string;
    scorecardLabelPrelaunch?: string;
    pricingLabel?: string;
    durationLabel?: string;
    scorecardTemplate?: string;
    scorecardTemplatePrelaunch?: string;
    pricingTemplate?: string;
    durationTemplate?: string;
    specTemplate?: string;
    resolutionTemplate?: string;
    bestLabel?: string;
  };
  metrics?: Record<string, { label?: string; tooltip?: string }>;
  breadcrumb?: { root?: string };
};

export type CompareDetailLabels = {
  pending: string;
  supported: string;
  notSupported: string;
  na: string;
  prompt: string;
  tryPrompt: string;
  tryPromptPrelaunch: string;
  opensGenerator: string;
  opensGeneratorPrelaunch: string;
  savePromptForLaunch: string;
  whatTests: string;
  placeholder: string;
  expandPrompt: string;
  collapsePrompt: string;
};

export function buildCompareDetailLabels(compareCopy: ComparePageCopy): CompareDetailLabels {
  return {
    pending: compareCopy.labels?.pending ?? 'Data pending',
    supported: compareCopy.labels?.supported ?? 'Supported',
    notSupported: compareCopy.labels?.notSupported ?? 'Not supported',
    na: compareCopy.labels?.na ?? 'N/A',
    prompt: compareCopy.labels?.prompt ?? 'Prompt',
    tryPrompt: compareCopy.labels?.tryPrompt ?? 'Try this prompt:',
    tryPromptPrelaunch: compareCopy.labels?.tryPromptPrelaunch ?? 'Prompt actions:',
    opensGenerator: compareCopy.labels?.opensGenerator ?? 'Opens the generator pre-filled.',
    opensGeneratorPrelaunch:
      compareCopy.labels?.opensGeneratorPrelaunch ??
      'Use these prompt links for planning; pre-launch engines unlock at launch.',
    savePromptForLaunch: compareCopy.labels?.savePromptForLaunch ?? 'Save this prompt for launch',
    whatTests: compareCopy.labels?.whatTests ?? 'What it tests',
    placeholder: compareCopy.labels?.placeholder ?? '',
    expandPrompt: compareCopy.labels?.expandPrompt ?? 'Show full prompt',
    collapsePrompt: compareCopy.labels?.collapsePrompt ?? 'Hide full prompt',
  };
}

export function buildCompareDetailPageText({
  activeLocale,
  compareCopy,
  criteriaCount,
  hasPrelaunchEngine,
  labels,
  pageHeroIntro,
  pairHasKling3Native4k,
  hasShowdownSlots,
}: {
  activeLocale: AppLocale;
  compareCopy: ComparePageCopy;
  criteriaCount: number;
  hasPrelaunchEngine: boolean;
  labels: CompareDetailLabels;
  pageHeroIntro?: string | null;
  pairHasKling3Native4k: boolean;
  hasShowdownSlots: boolean;
}) {
  const prelaunchNotice = hasPrelaunchEngine
    ? {
        title: compareCopy.prelaunch?.title ?? getPrelaunchCompareNotice(activeLocale).title,
        body: compareCopy.prelaunch?.notice ?? getPrelaunchCompareNotice(activeLocale).body,
      }
    : null;
  const noShowdownHeroIntro =
    activeLocale === 'fr'
      ? `Cette page compare {left} vs {right} sur MaxVideoAI avec les specs clés, les prix, les contrôles et une grille de score sur ${criteriaCount} critères. Les vidéos côte à côte curées seront ajoutées quand des rendus dédiés seront disponibles.`
      : activeLocale === 'es'
        ? `Esta página compara {left} vs {right} en MaxVideoAI con especificaciones clave, precios, controles y una puntuación de ${criteriaCount} criterios. Los vídeos comparativos curados se añadirán cuando haya renders dedicados disponibles.`
        : `This page compares {left} vs {right} on MaxVideoAI using key specs, pricing, controls, and a scorecard across ${criteriaCount} criteria. Curated side-by-side videos will be added once model-specific renders are available.`;
  const heroIntroTemplate = replaceCriteriaCount(
    pairHasKling3Native4k
      ? (pageHeroIntro ??
        `This page compares {left} vs {right} on MaxVideoAI across native 4K delivery, iteration cost, key specs, and a scorecard across ${criteriaCount} criteria. Use it to decide when 4K is worth the premium before opening each engine profile for full specs.`)
      : hasPrelaunchEngine
        ? (compareCopy.hero?.introPrelaunch ??
          `This page compares {left} vs {right} on MaxVideoAI using the same prompts, side-by-side prompts and renders (when available), key specs, and a scorecard across ${criteriaCount} criteria. Use it to shortlist the best fit — then open each engine profile for full specs and prompt examples.`)
        : !hasShowdownSlots
          ? (pageHeroIntro ?? noShowdownHeroIntro)
        : (pageHeroIntro ??
          compareCopy.hero?.intro ??
          `This page compares {left} vs {right} on MaxVideoAI using the same prompts, side-by-side renders, key specs, and a scorecard across ${criteriaCount} criteria. Use it to shortlist the best fit — then open each engine profile for full specs and prompt examples.`),
    criteriaCount
  );
  const showdownSubtitle = hasPrelaunchEngine
    ? (compareCopy.showdown?.subtitlePrelaunch ??
      'Side-by-side prompts and renders (when available) on MaxVideoAI. Prompts are identical; outputs may vary by model.')
    : (compareCopy.showdown?.subtitle ??
      'Side-by-side renders from the same prompt on MaxVideoAI. Prompts are identical; outputs may vary by model.');
  const scorecardProvisionalNote = hasPrelaunchEngine
    ? (compareCopy.scorecard?.provisionalNote ??
      'Pre-launch scores are provisional and will update once runtime renders and final pricing are available.')
    : null;
  const prelaunchTryPromptLabel = hasPrelaunchEngine ? labels.tryPromptPrelaunch : labels.tryPrompt;
  const prelaunchOpensGeneratorLabel = hasPrelaunchEngine ? labels.opensGeneratorPrelaunch : labels.opensGenerator;
  const exposeSourcePrompt = activeLocale === 'en';
  const showdownActionLabel = exposeSourcePrompt
    ? prelaunchTryPromptLabel
    : activeLocale === 'fr'
      ? 'Ouvrir le générateur :'
      : activeLocale === 'es'
        ? 'Abrir el generador:'
        : 'Open generator:';
  const showdownActionHint = exposeSourcePrompt
    ? prelaunchOpensGeneratorLabel
    : activeLocale === 'fr'
      ? 'Ouvre le générateur avec ce modèle.'
      : activeLocale === 'es'
        ? 'Abre el generador con este modelo.'
        : 'Opens the generator with this model.';
  const localizedPromptNote = activeLocale === 'fr'
    ? 'Les prompts source restent en anglais pour conserver le meme test entre modèles.'
    : activeLocale === 'es'
      ? 'Los prompts originales se mantienen en ingles para conservar la misma prueba entre motores.'
      : 'Source prompts stay in English to keep the same test across engines.';
  const winnerSummaryHeading = hasPrelaunchEngine
    ? (compareCopy.scorecard?.winnerSummaryPrelaunch ?? 'Current leader (pre-launch)')
    : (compareCopy.scorecard?.winnerSummary ?? 'Winner summary');
  const scorecardCriteriaLabel =
    activeLocale === 'fr' ? 'Critères' : activeLocale === 'es' ? 'Criterios' : 'Criteria';
  const generateWithLabel = formatTemplate(compareCopy.scorecard?.generateWith ?? 'Generate with {engine}', {
    engine: '',
  }).trim();

  return {
    exposeSourcePrompt,
    generateWithLabel,
    heroIntroTemplate,
    localizedPromptNote,
    prelaunchNotice,
    scorecardCriteriaLabel,
    scorecardProvisionalNote,
    showdownActionHint,
    showdownActionLabel,
    showdownSubtitle,
    winnerSummaryHeading,
  };
}
