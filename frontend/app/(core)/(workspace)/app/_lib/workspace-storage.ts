export const STORAGE_KEYS = {
  prompt: 'maxvideoai.generate.prompt.v1',
  negativePrompt: 'maxvideoai.generate.negativePrompt.v1',
  form: 'maxvideoai.generate.form.v1',
  memberTier: 'maxvideoai.generate.memberTier.v1',
  pendingRenders: 'maxvideoai.generate.pendingRenders.v1',
  previewJobId: 'maxvideoai.generate.previewJobId.v1',
  multiPromptEnabled: 'maxvideoai.generate.multiPromptEnabled.v1',
  multiPromptScenes: 'maxvideoai.generate.multiPromptScenes.v1',
  shotType: 'maxvideoai.generate.shotType.v1',
  voiceIds: 'maxvideoai.generate.voiceIds.v1',
} as const;

export function buildWorkspaceStorageKey(base: string, scope: string): string {
  return `${base}:${scope}`;
}

export function readScopedWorkspaceStorage(base: string, scope: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(buildWorkspaceStorageKey(base, scope));
}

export function readWorkspaceStorage(base: string, scope: string): string | null {
  if (typeof window === 'undefined') return null;
  // Prefer the unscoped "last state" to survive auth transitions and hard refreshes.
  if (scope === 'anon') {
    const baseValue = window.localStorage.getItem(base);
    if (baseValue !== null) return baseValue;
    return window.localStorage.getItem(buildWorkspaceStorageKey(base, scope));
  }

  const scopedValue = window.localStorage.getItem(buildWorkspaceStorageKey(base, scope));
  if (scopedValue !== null) return scopedValue;

  const baseValue = window.localStorage.getItem(base);
  if (baseValue !== null) return baseValue;

  const anonValue = window.localStorage.getItem(buildWorkspaceStorageKey(base, 'anon'));
  if (anonValue !== null) return anonValue;

  return null;
}

export function writeScopedWorkspaceStorage(base: string, scope: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  const key = buildWorkspaceStorageKey(base, scope);
  if (value === null) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, value);
  }
  window.localStorage.removeItem(base);
}

export function writeWorkspaceStorage(base: string, scope: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  const key = buildWorkspaceStorageKey(base, scope);
  if (value === null) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, value);
  }
  // Always keep an unscoped fallback so the last state survives auth transitions/navigation.
  if (value === null) {
    window.localStorage.removeItem(base);
  } else {
    window.localStorage.setItem(base, value);
  }
}
