import type { StudioAssistantModel } from './studio/assistance-contract';

export type StudioReference = { assetId: string; kind: 'image' | 'video' | 'audio'; label?: string };
const referenceTypes = { image: 'Image', video: 'Video', audio: 'Audio' };
export const studioReferenceLabel = (kind: StudioReference['kind'], ordinal: number) => `${referenceTypes[kind]} ${ordinal}`;
export function studioReferenceOrdinal(kind: StudioReference['kind'], label?: string) {
  const parts = typeof label === 'string' ? label.match(/^(Image|Video|Audio) ([1-9]\d{0,5})$/) : null;
  return parts?.[1] === referenceTypes[kind] ? Number(parts[2]) : 0;
}
export type StudioPhotoRead = { assetId: string } & (
  | { state: 'ready'; name?: string; thumbnail?: string; original?: string }
  | { state: 'unavailable' }
);
export type StudioProject = { id: string; name: string; updatedAt: string };
export type StudioQuoteReview = {
  canRenew?: true;
  quoteId: string;
  requestHash: string;
  expiresAt: string;
  wallet: 'ready' | 'insufficient' | 'unavailable';
  title: string;
  settings: string;
  direction: string;
  references: string;
  operation: string;
  outputCount: number;
  notices?: string[];
};
export type StudioOutput = { kind: 'image' | 'video' | 'audio'; url: string; originalUrl?: string; previewUrl?: string };
export type StudioGeneration = {
  jobId: string;
  status: 'accepted' | 'running' | 'completed' | 'failed';
  outputs: StudioOutput[];
};
export const STUDIO_AUTO_LITE_HEADER = 'x-maxvideoai-studio-auto-lite';
export type StudioAllowance = {
  lowCreditsRemaining?: number;
  model: StudioAssistantModel;
  label: string;
  revision: number;
  mediaEnabled?: boolean;
  stableReferenceLabels?: true;
  policyVersion: string;
  maxCredits: number;
  customerMaxCredits: number;
};
export type StudioMessage = {
  continuedWithLite?: true;
  requestId: string;
  renewedFromRequestId?: string;
  message: string;
  media?: StudioReference[];
  reply: string | null;
  state: 'thinking' | 'ready' | 'failed' | 'paused';
  quote: { label: string; amountCents: number; currency: string; state: string; review?: StudioQuoteReview } | null;
  generation?: StudioGeneration;
  webReview?: true;
};
export type StudioJournal = {
  projectId: string;
  projectName: string;
  stableReferenceLabels?: true;
  referenceOrdinals?: Record<StudioReference['kind'], number>;
  turns: StudioMessage[];
  allowance: StudioAllowance | null;
};
export type StudioSubmission = {
  action: 'message';
  confirmed: true;
  media?: StudioReference[];
  requestId: string;
  message: string;
  locale: 'en' | 'fr' | 'es';
  model: StudioAssistantModel;
  assistanceRevision: number;
  policyVersion: string;
  maxCredits: number;
  customerMaxCredits: number;
};
