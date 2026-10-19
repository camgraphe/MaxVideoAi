import type { ComparePageCopy } from './compare-page-copy';
import type { EngineScore } from './compare-page-types';

type PairScores = {
  leftScore: number | null;
  rightScore: number | null;
};

export type CompareMetric = {
  id: string;
  label: string;
  tooltip: string;
  leftValue: number | null;
  rightValue: number | null;
};

// Price/value belongs to the broader methodology, not this scorecard.
export function getComparisonCriteriaCount(pairHasNativeAudio: boolean) {
  return pairHasNativeAudio ? 10 : 9;
}

export function buildComparisonMetrics({
  compareCopy,
  leftScore,
  rightScore,
  pairHasNativeAudio,
  speedScores,
}: {
  compareCopy: ComparePageCopy;
  leftScore: EngineScore | null;
  rightScore: EngineScore | null;
  pairHasNativeAudio: boolean;
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
