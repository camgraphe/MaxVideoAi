// Reporting metadata supplied by the native app at the confirmation gesture.
export type NativeGenerationPlatform = 'ios' | 'android';

export function isNativeGenerationPlatform(value: unknown): value is NativeGenerationPlatform {
  return value === 'ios' || value === 'android';
}

export function withNativeConfirmationPlatform<T extends { authMethod: string }>(actor: T, headers: Headers) {
  const platform = headers.get('x-maxvideoai-client-platform');
  if (!isNativeGenerationPlatform(platform) || !isNativeSession(actor.authMethod)) return actor;
  return { ...actor, confirmationPlatform: platform };
}

function isNativeSession(method: string) {
  return method === 'studio-session' || method === 'mobile-session';
}

export function generationClaimPlatform(actor: { authMethod: string; confirmationPlatform?: NativeGenerationPlatform }) {
  return isNativeSession(actor.authMethod) && isNativeGenerationPlatform(actor.confirmationPlatform)
    ? actor.confirmationPlatform : undefined;
}
