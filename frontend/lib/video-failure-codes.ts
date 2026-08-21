export const SEEDANCE_OUTPUT_COPYRIGHT_RESTRICTED = 'seedance_output_copyright_restricted';
export const SEEDANCE_INPUT_VIDEO_TOO_SMALL = 'seedance_input_video_too_small';
export const SEEDANCE_I2V_RATIO_REJECTED = 'seedance_i2v_ratio_rejected';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function getVideoFailureCodeFromSettingsSnapshot(settingsSnapshot: unknown): string | null {
  if (!isRecord(settingsSnapshot) || !isRecord(settingsSnapshot.providerFailure)) return null;
  const failureCode = settingsSnapshot.providerFailure.failureCode;
  return typeof failureCode === 'string' && failureCode.length ? failureCode : null;
}
