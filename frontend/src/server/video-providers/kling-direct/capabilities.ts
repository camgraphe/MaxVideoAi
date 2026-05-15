import type { GeneratePayload } from '@/lib/fal';
import { stripKlingDirectOnlyExtraInputValues } from '@/lib/kling-direct-extra-values';
import type { KlingDirectModelRoute } from './model-map';

export type KlingDirectSubmitCapabilities = {
  audio: boolean;
  cameraControl: boolean;
  elementList: boolean;
  motionBrush: boolean;
  multiShot: boolean;
  startEndFrame: boolean;
  voiceControl: boolean;
};

export type KlingDirectRouteCapabilities = {
  providerModel: 'kling-v3';
  t2v: KlingDirectSubmitCapabilities;
  i2v: KlingDirectSubmitCapabilities;
};

const KLING_V3_TEXT_CAPABILITIES: KlingDirectSubmitCapabilities = {
  audio: true,
  cameraControl: false,
  elementList: false,
  motionBrush: false,
  multiShot: true,
  startEndFrame: false,
  voiceControl: false,
};

const KLING_V3_IMAGE_STD_PRO_CAPABILITIES: KlingDirectSubmitCapabilities = {
  audio: true,
  cameraControl: true,
  elementList: true,
  motionBrush: true,
  multiShot: true,
  startEndFrame: true,
  voiceControl: false,
};

const KLING_V3_IMAGE_4K_CAPABILITIES: KlingDirectSubmitCapabilities = {
  ...KLING_V3_IMAGE_STD_PRO_CAPABILITIES,
  cameraControl: false,
  motionBrush: false,
};

export function getKlingDirectRouteCapabilities(route: KlingDirectModelRoute): KlingDirectRouteCapabilities {
  return {
    providerModel: route.providerModel,
    t2v: KLING_V3_TEXT_CAPABILITIES,
    i2v: route.mode === '4k' ? KLING_V3_IMAGE_4K_CAPABILITIES : KLING_V3_IMAGE_STD_PRO_CAPABILITIES,
  };
}

export function sanitizeKlingDirectFalFallbackPayload(payload: GeneratePayload): GeneratePayload {
  const extraInputValues = stripKlingDirectOnlyExtraInputValues(payload.extraInputValues);
  return {
    ...payload,
    extraInputValues,
  };
}
