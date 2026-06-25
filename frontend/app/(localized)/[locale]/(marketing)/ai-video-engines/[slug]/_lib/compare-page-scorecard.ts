import clsx from 'clsx';
import type { AppLocale } from '@/i18n/locales';
import type { ComparePageCopy } from './compare-page-copy';
import type {
  ComparePricingDisplay,
  CompareSpecValues,
  EngineCatalogEntry,
  EngineScore,
} from './compare-page-types';
import { formatCompareFaqValue } from './compare-page-faq';
import {
  formatEngineName,
  formatTemplate,
  isPending,
  parseMaxDurationNumber,
  parseResolutionValue,
  type EngineAccent,
  type OverallTone,
} from './compare-page-helpers';

type PairScores = {
  leftScore: number | null;
  rightScore: number | null;
};

type CompareStatusLabels = {
  pending: string;
  supported: string;
  notSupported: string;
};

export type CompareMetric = {
  id: string;
  label: string;
  tooltip: string;
  leftValue: number | null;
  rightValue: number | null;
};

export type CompareSummaryRow = {
  id: string;
  icon: string;
  label: string;
  value: string;
  accent: OverallTone | null;
};

export function buildComparisonMetrics({
  compareCopy,
  leftScore,
  rightScore,
  pairHasNativeAudio,
  priceScores,
  speedScores,
}: {
  compareCopy: ComparePageCopy;
  leftScore: EngineScore | null;
  rightScore: EngineScore | null;
  pairHasNativeAudio: boolean;
  priceScores: PairScores;
  speedScores: PairScores;
}): CompareMetric[] {
  return [
    {
      id: 'prompt_adherence',
      label: compareCopy.metrics?.prompt_adherence?.label ?? 'Prompt Adherence',
      tooltip: compareCopy.metrics?.prompt_adherence?.tooltip ?? 'prompt alignment / instruction following',
      leftValue: leftScore?.fidelity ?? null,
      rightValue: rightScore?.fidelity ?? null,
    },
    {
      id: 'visual_quality',
      label: compareCopy.metrics?.visual_quality?.label ?? 'Visual Quality',
      tooltip:
        compareCopy.metrics?.visual_quality?.tooltip ??
        'image quality / aesthetic quality / realism / artifacts / flicker',
      leftValue: leftScore?.visualQuality ?? null,
      rightValue: rightScore?.visualQuality ?? null,
    },
    {
      id: 'motion_realism',
      label: compareCopy.metrics?.motion_realism?.label ?? 'Motion Realism',
      tooltip: compareCopy.metrics?.motion_realism?.tooltip ?? 'motion smoothness / physics plausibility',
      leftValue: leftScore?.motion ?? null,
      rightValue: rightScore?.motion ?? null,
    },
    {
      id: 'temporal_consistency',
      label: compareCopy.metrics?.temporal_consistency?.label ?? 'Temporal Consistency',
      tooltip:
        compareCopy.metrics?.temporal_consistency?.tooltip ?? 'temporal coherence / identity consistency',
      leftValue: leftScore?.consistency ?? null,
      rightValue: rightScore?.consistency ?? null,
    },
    {
      id: 'human_fidelity',
      label: compareCopy.metrics?.human_fidelity?.label ?? 'Human Fidelity',
      tooltip: compareCopy.metrics?.human_fidelity?.tooltip ?? 'faces / hands / body realism',
      leftValue: leftScore?.anatomy ?? null,
      rightValue: rightScore?.anatomy ?? null,
    },
    {
      id: 'text_ui_legibility',
      label: compareCopy.metrics?.text_ui_legibility?.label ?? 'Text & UI Legibility',
      tooltip: compareCopy.metrics?.text_ui_legibility?.tooltip ?? 'text rendering / readability',
      leftValue: leftScore?.textRendering ?? null,
      rightValue: rightScore?.textRendering ?? null,
    },
    ...(pairHasNativeAudio
      ? [
          {
            id: 'audio_lip_sync',
            label: compareCopy.metrics?.audio_lip_sync?.label ?? 'Audio & Lip Sync',
            tooltip: compareCopy.metrics?.audio_lip_sync?.tooltip ?? 'lip sync quality / dialogue sync',
            leftValue: leftScore?.lipsyncQuality ?? null,
            rightValue: rightScore?.lipsyncQuality ?? null,
          },
        ]
      : []),
    {
      id: 'multi_shot_sequencing',
      label: compareCopy.metrics?.multi_shot_sequencing?.label ?? 'Multi-Shot Sequencing',
      tooltip:
        compareCopy.metrics?.multi_shot_sequencing?.tooltip ?? 'shot-to-shot continuity / multi-shot',
      leftValue: leftScore?.sequencingQuality ?? null,
      rightValue: rightScore?.sequencingQuality ?? null,
    },
    {
      id: 'controllability',
      label: compareCopy.metrics?.controllability?.label ?? 'Controllability',
      tooltip: compareCopy.metrics?.controllability?.tooltip ?? 'camera control / constraint following',
      leftValue: leftScore?.controllability ?? null,
      rightValue: rightScore?.controllability ?? null,
    },
    {
      id: 'speed_stability',
      label: compareCopy.metrics?.speed_stability?.label ?? 'Speed & Stability',
      tooltip: compareCopy.metrics?.speed_stability?.tooltip ?? 'latency / success rate',
      leftValue: leftScore?.speedStability ?? speedScores.leftScore,
      rightValue: rightScore?.speedStability ?? speedScores.rightScore,
    },
    {
      id: 'pricing',
      label: compareCopy.metrics?.pricing?.label ?? 'Pricing',
      tooltip:
        compareCopy.metrics?.pricing?.tooltip ?? 'price per second / credits / estimated cost',
      leftValue: priceScores.leftScore,
      rightValue: priceScores.rightScore,
    },
  ];
}

export function deriveCompareStrengths(comparisonMetrics: CompareMetric[], side: 'left' | 'right') {
  return comparisonMetrics
    .filter((metric) => typeof metric.leftValue === 'number' && typeof metric.rightValue === 'number')
    .map((metric) => {
      const leftValue = metric.leftValue as number;
      const rightValue = metric.rightValue as number;
      if (side === 'left' && leftValue > rightValue) {
        return { label: metric.label, delta: Math.abs(leftValue - rightValue) };
      }
      if (side === 'right' && rightValue > leftValue) {
        return { label: metric.label, delta: Math.abs(leftValue - rightValue) };
      }
      return null;
    })
    .filter((entry): entry is { label: string; delta: number } => Boolean(entry))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2)
    .map((entry) => entry.label);
}

export function buildCompareSummaryRows({
  activeLocale,
  compareCopy,
  comparisonMetrics,
  hasPrelaunchEngine,
  labels,
  left,
  right,
  leftPricingDisplay,
  rightPricingDisplay,
  leftSpecs,
  rightSpecs,
  priceScores,
  specLabels,
}: {
  activeLocale: AppLocale;
  compareCopy: ComparePageCopy;
  comparisonMetrics: CompareMetric[];
  hasPrelaunchEngine: boolean;
  labels: CompareStatusLabels;
  left: EngineCatalogEntry;
  right: EngineCatalogEntry;
  leftPricingDisplay: ComparePricingDisplay;
  rightPricingDisplay: ComparePricingDisplay;
  leftSpecs: CompareSpecValues;
  rightSpecs: CompareSpecValues;
  priceScores: PairScores;
  specLabels: Record<string, string>;
}): CompareSummaryRow[] {
  const scoredMetrics = comparisonMetrics
    .filter((metric) => typeof metric.leftValue === 'number' && typeof metric.rightValue === 'number')
    .map((metric) => {
      const leftValue = metric.leftValue as number;
      const rightValue = metric.rightValue as number;
      const winner = leftValue === rightValue ? 'tie' : leftValue > rightValue ? 'left' : 'right';
      return {
        label: metric.label,
        leftValue,
        rightValue,
        winner,
        delta: Math.abs(leftValue - rightValue),
      };
    });
  const leftWins = scoredMetrics.filter((metric) => metric.winner === 'left').length;
  const rightWins = scoredMetrics.filter((metric) => metric.winner === 'right').length;
  const totalScored = scoredMetrics.length;
  const scoreLeader = leftWins === rightWins ? null : leftWins > rightWins ? 'left' : 'right';
  const topWinner = scoreLeader === 'left' ? left : scoreLeader === 'right' ? right : null;
  const topDeltas = scoredMetrics
    .filter((metric) => metric.winner === scoreLeader)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2)
    .map((metric) => metric.label);

  const pricingWinner =
    typeof priceScores.leftScore === 'number' && typeof priceScores.rightScore === 'number'
      ? priceScores.leftScore === priceScores.rightScore
        ? null
        : priceScores.leftScore > priceScores.rightScore
          ? 'left'
          : 'right'
      : null;

  const validatingLabel = compareCopy.faq?.validating ?? 'still being validated';
  const durationLeft = parseMaxDurationNumber(leftSpecs.maxDuration);
  const durationRight = parseMaxDurationNumber(rightSpecs.maxDuration);
  const durationWinner =
    typeof durationLeft === 'number' && typeof durationRight === 'number'
      ? durationLeft === durationRight
        ? null
        : durationLeft > durationRight
          ? 'left'
          : 'right'
      : null;
  const durationSummary = `${formatCompareFaqValue(
    leftSpecs.maxDuration,
    activeLocale,
    labels,
    validatingLabel
  )} vs ${formatCompareFaqValue(rightSpecs.maxDuration, activeLocale, labels, validatingLabel)}`;
  const pricingSummary = `${leftPricingDisplay.headline} vs ${rightPricingDisplay.headline}`;
  const summaryCopy = compareCopy.summary ?? {};
  const scorecardTemplate = hasPrelaunchEngine
    ? (summaryCopy.scorecardTemplatePrelaunch ??
      'Currently leads on scorecard (provisional): {engine} leads on {wins}/{total}{best}.')
    : (summaryCopy.scorecardTemplate ??
      'Scorecard winner: {engine} leads on {wins}/{total}{best}.');
  const scorecardSummaryLabel = hasPrelaunchEngine
    ? (summaryCopy.scorecardLabelPrelaunch ?? 'Currently leads on scorecard (provisional)')
    : (summaryCopy.scorecardLabel ?? 'Scorecard winner');
  const pricingTemplate =
    summaryCopy.pricingTemplate ??
    'Cheaper: {engine} ({pricing}).';
  const durationTemplate =
    summaryCopy.durationTemplate ??
    'Max duration: {engine} ({duration}).';
  const specTemplate =
    summaryCopy.specTemplate ??
    '{label}: {engine} ({leftValue} vs {rightValue}).';
  const resolutionTemplate =
    summaryCopy.resolutionTemplate ??
    'Max resolution: {engine} ({leftValue} vs {rightValue}).';
  const specWinnerRow: CompareSummaryRow | null = (() => {
    const valueForSupport = (label: string, leftValue: string, rightValue: string) => {
      const leftNormalized = leftValue.toLowerCase();
      const rightNormalized = rightValue.toLowerCase();
      const leftIsSupported = leftNormalized === 'supported' || leftNormalized.startsWith('supported ');
      const rightIsSupported = rightNormalized === 'supported' || rightNormalized.startsWith('supported ');
      if (leftIsSupported === rightIsSupported) return null;
      const winner = leftIsSupported ? 'left' : 'right';
      return {
        id: 'spec',
        icon: 'spec',
        label,
        value: formatTemplate(specTemplate, {
          label,
          engine: formatEngineName(winner === 'left' ? left : right),
          leftValue,
          rightValue,
        }),
        accent: winner as OverallTone,
      };
    };
    if (!isPending(leftSpecs.videoToVideo) && !isPending(rightSpecs.videoToVideo)) {
      const row = valueForSupport(
        specLabels.videoToVideo ?? 'Video-to-Video',
        leftSpecs.videoToVideo,
        rightSpecs.videoToVideo
      );
      if (row) return row;
    }
    if (!isPending(leftSpecs.firstLastFrame) && !isPending(rightSpecs.firstLastFrame)) {
      const row = valueForSupport(
        specLabels.firstLastFrame ?? 'First/Last frame',
        leftSpecs.firstLastFrame,
        rightSpecs.firstLastFrame
      );
      if (row) return row;
    }
    const leftRes = parseResolutionValue(leftSpecs.maxResolution);
    const rightRes = parseResolutionValue(rightSpecs.maxResolution);
    if (leftRes && rightRes && leftRes !== rightRes) {
      const winner = leftRes > rightRes ? 'left' : 'right';
      return {
        id: 'spec',
        icon: 'spec',
        label: specLabels.maxResolution ?? 'Max resolution',
        value: formatTemplate(resolutionTemplate, {
          engine: formatEngineName(winner === 'left' ? left : right),
          leftValue: leftSpecs.maxResolution,
          rightValue: rightSpecs.maxResolution,
        }),
        accent: winner as OverallTone,
      };
    }
    if (durationWinner) {
      return {
        id: 'duration',
        icon: 'duration',
        label: summaryCopy.durationLabel ?? 'Max duration',
        value: formatTemplate(durationTemplate, {
          engine: formatEngineName(durationWinner === 'left' ? left : right),
          duration: durationSummary,
        }),
        accent: durationWinner,
      };
    }
    return null;
  })();
  const winnerSummaryRows: CompareSummaryRow[] = [];
  if (scoreLeader && topWinner) {
    winnerSummaryRows.push({
      id: 'scorecard',
      icon: 'scorecard',
      label: scorecardSummaryLabel,
      value: formatTemplate(scorecardTemplate, {
        engine: formatEngineName(topWinner),
        wins: String(scoreLeader === 'left' ? leftWins : rightWins),
        total: String(totalScored),
        best: topDeltas.length ? ` (${compareCopy.summary?.bestLabel ?? 'best'}: ${topDeltas.join(', ')})` : '',
      }),
      accent: scoreLeader,
    });
  }
  if (pricingWinner) {
    winnerSummaryRows.push({
      id: 'pricing',
      icon: 'pricing',
      label: summaryCopy.pricingLabel ?? 'Pricing',
      value: formatTemplate(pricingTemplate, {
        engine: formatEngineName(pricingWinner === 'left' ? left : right),
        pricing: pricingSummary,
        tarifs: pricingSummary,
      }),
      accent: pricingWinner,
    });
  }
  if (specWinnerRow) {
    winnerSummaryRows.push(specWinnerRow);
  } else if (durationWinner) {
    winnerSummaryRows.push({
      id: 'duration',
      icon: 'duration',
      label: summaryCopy.durationLabel ?? 'Max duration',
      value: formatTemplate(durationTemplate, {
        engine: formatEngineName(durationWinner === 'left' ? left : right),
        duration: durationSummary,
      }),
      accent: durationWinner,
    });
  }
  return winnerSummaryRows.slice(0, 3);
}

export function resolveSummaryMarker(
  rowId: string,
  accent: OverallTone | null,
  leftAccent: EngineAccent,
  rightAccent: EngineAccent
) {
  if (rowId === 'pricing') {
    return 'rounded-full bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.12)]';
  }
  if (rowId === 'scorecard' || rowId === 'spec' || rowId === 'duration') {
    return 'rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]';
  }
  if (accent === 'left') return clsx('rounded-full shadow-[0_0_0_4px_rgba(46,99,216,0.12)]', leftAccent.barClass);
  if (accent === 'right') return clsx('rounded-full shadow-[0_0_0_4px_rgba(46,99,216,0.12)]', rightAccent.barClass);
  return 'rounded-full bg-neutral-300';
}

export function resolveSummaryLabelClass(rowId: string) {
  if (rowId === 'scorecard' || rowId === 'spec' || rowId === 'duration') {
    return 'text-emerald-600 dark:text-emerald-300';
  }
  if (rowId === 'pricing') {
    return 'text-orange-600 dark:text-orange-300';
  }
  return 'text-text-muted';
}

export function formatWinnerSummaryValue(row: { id: string; value: string }) {
  if (row.id !== 'scorecard') return row.value;
  return row.value
    .replace(/^Leads on scorecard:\s*/i, '')
    .replace(/^Scorecard winner:\s*/i, '')
    .replace(/^Currently leads on scorecard \(provisional\):\s*/i, '');
}
