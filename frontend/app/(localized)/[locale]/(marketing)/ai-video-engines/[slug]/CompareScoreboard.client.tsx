import { PairedScores, type PairedMetric } from '@/components/marketing/PairedScores';

export type CompareMetric = PairedMetric;

export function CompareScoreboard({ metrics, className, naLabel = 'N/A' }: {
  metrics: CompareMetric[]; className?: string; naLabel?: string; pendingLabel?: string;
}) {
  return <PairedScores metrics={metrics} className={className} naLabel={naLabel} />;
}
