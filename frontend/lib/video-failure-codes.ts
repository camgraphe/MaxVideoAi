export const SEEDANCE_OUTPUT_COPYRIGHT_RESTRICTED = 'seedance_output_copyright_restricted';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function getVideoFailureCodeFromSettingsSnapshot(settingsSnapshot: unknown): string | null {
  if (!isRecord(settingsSnapshot) || !isRecord(settingsSnapshot.providerFailure)) return null;
  const failureCode = settingsSnapshot.providerFailure.failureCode;
  return typeof failureCode === 'string' && failureCode.length ? failureCode : null;
}
