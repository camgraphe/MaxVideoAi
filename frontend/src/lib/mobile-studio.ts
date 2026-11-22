import type { StudioAssistantModel } from './studio/assistance-contract';

export type StudioReference = { assetId: string; kind: 'image' | 'video' | 'audio' };
export type StudioProject = { id: string; name: string; updatedAt: string };
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
  quote: { label: string; amountCents: number; currency: string; state: string } | null;
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
