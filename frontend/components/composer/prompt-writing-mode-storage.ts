export type PromptWritingMode = 'prompt' | 'milo';

/** Same tab lifetime and account/surface/workflow boundary as the conversation, without its content. */
export const promptWritingModeStorageKey = (account: string, surface: string, workflow: string) =>
  `milo-writing-mode:v1:${JSON.stringify([account, surface, workflow])}`;

export function readPromptWritingMode(key: string | null): PromptWritingMode | null {
  if (!key) return null;
  try {
    const mode = sessionStorage.getItem(key);
    return mode === 'prompt' || mode === 'milo' ? mode : null;
  } catch { return null; }
}

export function writePromptWritingMode(key: string | null, mode: PromptWritingMode) {
  if (!key) return;
  try { sessionStorage.setItem(key, mode); } catch { /* Writing remains available without browser storage. */ }
}
