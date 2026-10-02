import {
  BYTEPLUS_SEEDANCE_2_5_DURATION_OPTIONS,
  BYTEPLUS_SEEDANCE_2_5_MODES,
} from './byteplus-modelark-constants';
import { BytePlusModelArkError } from './byteplus-modelark-error';
import {
  buildBytePlusSeedancePayload,
  type BytePlusSeedancePayload,
} from './byteplus-modelark-payload';

type DraftInput = Parameters<typeof buildBytePlusSeedancePayload>[0];

export type Seedance25DraftRequest = BytePlusSeedancePayload & { draft: true };

export type Seedance25FinalRequest = {
  model: string;
  content: [{ type: 'draft_task'; draft_task: { id: string } }];
  resolution: '1080p';
  watermark: false;
};

export function buildSeedance25DraftRequest(input: DraftInput): Seedance25DraftRequest {
  if (input.resolution && input.resolution !== '480p') {
    throw new BytePlusModelArkError('Seedance 2.5 Draft requires 480p.', {
      code: 'BYTEPLUS_DRAFT_RESOLUTION_UNSUPPORTED',
    });
  }
  return {
    ...buildBytePlusSeedancePayload({
      ...input,
      resolution: '480p',
      allowedResolutions: ['480p'],
      allowedDurationOptions: BYTEPLUS_SEEDANCE_2_5_DURATION_OPTIONS,
      allowedModes: BYTEPLUS_SEEDANCE_2_5_MODES,
      inheritSourceAspectRatio: true,
    }),
    draft: true,
  };
}

export function buildSeedance25FinalRequest(input: {
  modelId: string;
  draftProviderTaskId: string;
}): Seedance25FinalRequest {
  const model = input.modelId.trim();
  const draftProviderTaskId = input.draftProviderTaskId.trim();
  if (!model || !draftProviderTaskId || draftProviderTaskId.length > 255 || /\s/u.test(draftProviderTaskId)) {
    throw new BytePlusModelArkError('Seedance 2.5 Draft reference is invalid.', {
      code: 'BYTEPLUS_DRAFT_REFERENCE_INVALID',
    });
  }
  return {
    model,
    content: [{ type: 'draft_task', draft_task: { id: draftProviderTaskId } }],
    resolution: '1080p',
    watermark: false,
  };
}
