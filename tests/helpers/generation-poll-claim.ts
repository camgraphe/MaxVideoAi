import type { GenerationPollClaim } from '../../frontend/server/generation-poll-state';
export const allowGenerationPoll = async (): Promise<GenerationPollClaim> => ({ checked: async () => {}, release: async () => {} });
