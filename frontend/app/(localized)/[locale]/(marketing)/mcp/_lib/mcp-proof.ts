import type { AppLocale } from '@/i18n/locales';

export type McpProofEvidence = {
  jobEvidenceReference: string;
  auditEvidenceReference: string;
  sourceUrl: string;
  sourceSha256: string;
};

export type McpProof = {
  posterSrc: string;
  videoSrc: string;
  alt: string;
  badge: string;
  caption: string;
  engineId: string;
  mode: string;
  durationSeconds: number;
  aspectRatio: string;
  resolution: string;
  amountCents: number;
  currency: string;
  verifiedAt: string;
  evidence: McpProofEvidence;
};

export function getMcpProof(locale: AppLocale): Promise<McpProof | null> {
  void locale;
  return Promise.resolve(null);
}
