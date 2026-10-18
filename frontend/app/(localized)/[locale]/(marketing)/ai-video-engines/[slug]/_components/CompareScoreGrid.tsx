import type { AppLocale } from '@/i18n/locales';
import { Circle, Diamond } from 'lucide-react';
import type { CompareMetric } from '../_lib/compare-page-scorecard';

const LABELS: Record<AppLocale, Record<string, string>> = {
  en: {
    prompt_adherence: 'Follows your prompt', visual_quality: 'Visual quality',
    motion_realism: 'Natural movement', temporal_consistency: 'Consistency over time',
    human_fidelity: 'Human appearance', text_ui_legibility: 'Readable text',
    audio_lip_sync: 'Audio & lip sync', multi_shot_sequencing: 'Multi-shot continuity',
    controllability: 'Creative control', speed_stability: 'Speed & reliability',
  },
  fr: {
    prompt_adherence: 'Suit vos instructions', visual_quality: 'Qualité visuelle',
    motion_realism: 'Mouvements naturels', temporal_consistency: 'Cohérence dans le temps',
    human_fidelity: 'Rendu des personnes', text_ui_legibility: 'Texte lisible',
    audio_lip_sync: 'Son et synchronisation des lèvres', multi_shot_sequencing: 'Continuité entre les plans',
    controllability: 'Maîtrise créative', speed_stability: 'Rapidité et fiabilité',
  },
  es: {
    prompt_adherence: 'Sigue tus instrucciones', visual_quality: 'Calidad visual',
    motion_realism: 'Movimiento natural', temporal_consistency: 'Coherencia en el tiempo',
    human_fidelity: 'Aspecto de las personas', text_ui_legibility: 'Texto legible',
    audio_lip_sync: 'Audio y sincronización labial', multi_shot_sequencing: 'Continuidad entre tomas',
    controllability: 'Control creativo', speed_stability: 'Rapidez y fiabilidad',
  },
};

const DESCRIPTIONS: Record<AppLocale, Record<string, string>> = {
  en: {
    prompt_adherence: 'How closely the result follows the prompt.',
    visual_quality: 'Detail, lighting and visible artifacts.',
    motion_realism: 'How naturally subjects and cameras move.',
    temporal_consistency: 'Whether details hold together over time.',
    human_fidelity: 'Faces, hands and body movement.',
    text_ui_legibility: 'How readable generated text and interfaces are.',
    audio_lip_sync: 'Speech, sound and mouth movement in sync.',
    multi_shot_sequencing: 'Continuity between different shots.',
    controllability: 'How much direction the model follows.',
    speed_stability: 'Generation speed and reliability.',
  },
  fr: {
    prompt_adherence: 'Fidélité du résultat à la consigne.',
    visual_quality: 'Détails, lumière et défauts visibles.',
    motion_realism: 'Naturel des mouvements et de la caméra.',
    temporal_consistency: 'Stabilité des détails dans le temps.',
    human_fidelity: 'Visages, mains et mouvements du corps.',
    text_ui_legibility: 'Lisibilité du texte et des interfaces générés.',
    audio_lip_sync: 'Voix, son et mouvement des lèvres.',
    multi_shot_sequencing: 'Continuité entre plusieurs plans.',
    controllability: 'Précision des réglages et des instructions.',
    speed_stability: 'Vitesse et fiabilité de la génération.',
  },
  es: {
    prompt_adherence: 'Fidelidad del resultado a las instrucciones.',
    visual_quality: 'Detalle, luz y defectos visibles.',
    motion_realism: 'Naturalidad del movimiento y de la cámara.',
    temporal_consistency: 'Continuidad de los detalles en el tiempo.',
    human_fidelity: 'Rostros, manos y movimiento corporal.',
    text_ui_legibility: 'Legibilidad del texto y las interfaces generadas.',
    audio_lip_sync: 'Voz, sonido y movimiento de los labios.',
    multi_shot_sequencing: 'Continuidad entre distintas tomas.',
    controllability: 'Precisión de los controles e instrucciones.',
    speed_stability: 'Velocidad y fiabilidad de la generación.',
  },
};

const PRIORITY = [
  'prompt_adherence',
  'visual_quality',
  'motion_realism',
  'human_fidelity',
  'audio_lip_sync',
  'controllability',
  'temporal_consistency',
  'text_ui_legibility',
  'multi_shot_sequencing',
  'speed_stability',
];

export function orderCompareMetrics(metrics: CompareMetric[]) {
  return [...metrics].sort((a, b) => {
    const left = PRIORITY.indexOf(a.id);
    const right = PRIORITY.indexOf(b.id);
    return (left < 0 ? PRIORITY.length : left) - (right < 0 ? PRIORITY.length : right);
  });
}

export function describeCompareMetric(metric: CompareMetric, locale: AppLocale) {
  return DESCRIPTIONS[locale][metric.id] ?? metric.tooltip;
}

export function labelCompareMetric(metric: CompareMetric, locale: AppLocale) {
  return LABELS[locale][metric.id] ?? metric.label;
}

export function formatCompareScoreValue(value: number | null, missingLabel: string) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : missingLabel;
}

function ScoreCell({ value, side, modelName, missingLabel }: {
  value: number | null;
  side: 'left' | 'right';
  modelName: string;
  missingLabel: string;
}) {
  const valid = typeof value === 'number' && Number.isFinite(value);
  return (
    <td className={`compare-score-value compare-score-value--${side}`}>
      <div className="compare-score-cell">
        <span className="compare-score-mobile-name">{modelName}</span>
        <span className="compare-score-number">{formatCompareScoreValue(value, missingLabel)}<small>{valid ? '/10' : null}</small></span>
        <span className="compare-score-track" aria-hidden="true"><span style={{ width: `${valid ? Math.max(0, Math.min(value, 10)) * 10 : 0}%` }} /></span>
      </div>
    </td>
  );
}

export function CompareScoreGrid({ metrics, locale, leftName, rightName, missingLabel }: {
  metrics: CompareMetric[];
  locale: AppLocale;
  leftName: string;
  rightName: string;
  missingLabel: string;
}) {
  return (
    <table className="compare-score-grid">
      <colgroup><col className="compare-score-criterion-col" /><col /><col /></colgroup>
      <thead><tr>
        <th scope="col">{({ en: 'Criterion', fr: 'Critère', es: 'Criterio' } as const)[locale]} <span className="compare-score-scale">· 0–10</span></th>
        <th scope="col" className="compare-score-model-heading compare-score-model-heading--left"><Circle size={13} fill="currentColor" className="compare-score-model-mark" aria-hidden="true" />{leftName}</th>
        <th scope="col" className="compare-score-model-heading compare-score-model-heading--right"><Diamond size={13} fill="currentColor" className="compare-score-model-mark" aria-hidden="true" />{rightName}</th>
      </tr></thead>
      <tbody>{metrics.map((metric) => <tr key={metric.id}>
        <th scope="row"><strong>{labelCompareMetric(metric, locale)}</strong><small>{describeCompareMetric(metric, locale)}</small></th>
        <ScoreCell value={metric.leftValue} side="left" modelName={leftName} missingLabel={missingLabel} />
        <ScoreCell value={metric.rightValue} side="right" modelName={rightName} missingLabel={missingLabel} />
      </tr>)}</tbody>
    </table>
  );
}
