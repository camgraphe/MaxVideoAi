import type { StudioAssistantModel } from './studio/assistance-contract';

export type StudioReference = { assetId: string; kind: 'image' | 'video' | 'audio' };
export type StudioProject = { id: string; name: string; updatedAt: string };
export type StudioQuoteReview = {
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
export type StudioOutput = { kind: 'image' | 'video' | 'audio'; url: string };
export type StudioGeneration = {
  jobId: string;
  status: 'accepted' | 'running' | 'completed' | 'failed';
  outputs: StudioOutput[];
};
export type StudioAllowance = {
  model: StudioAssistantModel;
  label: string;
  revision: number;
  mediaEnabled?: boolean;
  policyVersion: string;
  maxCredits: number;
  customerMaxCredits: number;
};
export type StudioMessage = {
  requestId: string;
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
