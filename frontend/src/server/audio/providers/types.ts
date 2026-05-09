export type AudioPipelineRole = 'soundDesign' | 'music' | 'tts' | 'voiceClone';

export type AudioProviderCandidate = {
  key: string;
  model: string;
  label: string;
};

export type AudioProviderResult = {
  url: string;
  providerKey: string;
  providerLabel: string;
  model: string;
  requestId?: string | null;
  customVoiceId?: string | null;
};

export type AudioProviderAttemptFailure = {
  providerKey: string;
  model: string;
  message: string;
};

export type AudioProviderSubscribe = (
  model: string,
  input: Record<string, unknown>
) => Promise<{ data: unknown; requestId?: string | null }>;
