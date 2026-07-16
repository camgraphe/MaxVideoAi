import { submitBytePlusGenerateTask } from './byteplus-submission';
import { submitGenerateProviderTask } from './video-provider-submission';
import { buildInitialProviderMediaState, resolveProviderMediaState } from './provider-media';
import { buildMissingProviderJobIdResponse } from './missing-provider-job';
import type { VideoGenerationAdapters } from '@/server/video-generation/execute-video-generation';

export const videoGenerationAdapters = {
  submitBytePlusGenerateTask,
  submitGenerateProviderTask,
  buildInitialProviderMediaState,
  resolveProviderMediaState,
  buildMissingProviderJobIdResponse,
} satisfies VideoGenerationAdapters;
