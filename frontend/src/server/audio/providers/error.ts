import type { AudioPipelineRole, AudioProviderAttemptFailure } from './types';

export class AudioProviderError extends Error {
  role: AudioPipelineRole;
  failures: AudioProviderAttemptFailure[];

  constructor(role: AudioPipelineRole, failures: AudioProviderAttemptFailure[]) {
    super(`All providers failed for role "${role}".`);
    this.name = 'AudioProviderError';
    this.role = role;
    this.failures = failures;
  }
}
