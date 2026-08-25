export const SEEDANCE_OUTPUT_COPYRIGHT_RESTRICTED = 'seedance_output_copyright_restricted';
export const SEEDANCE_INPUT_VIDEO_TOO_SMALL = 'seedance_input_video_too_small';
export const SEEDANCE_I2V_RATIO_REJECTED = 'seedance_i2v_ratio_rejected';
export const SEEDANCE_TASK_TYPE_CONSTRAINT = 'seedance_task_type_constraint';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function getVideoFailureCodeFromSettingsSnapshot(settingsSnapshot: unknown): string | null {
  if (!isRecord(settingsSnapshot) || !isRecord(settingsSnapshot.providerFailure)) return null;
  const providerFailure = settingsSnapshot.providerFailure;
  const failureCode = providerFailure.failureCode;
  if (typeof failureCode === 'string' && failureCode.length) return failureCode;
  const provider = providerFailure.provider;
  const providerErrorCode = providerFailure.providerErrorCode;
  if (
    provider === 'byteplus_modelark' &&
    typeof providerErrorCode === 'string' &&
    providerErrorCode.trim().toLowerCase() === 'invalidparameter.tasktypeconstraint'
  ) {
    return SEEDANCE_TASK_TYPE_CONSTRAINT;
  }
  return null;
}
