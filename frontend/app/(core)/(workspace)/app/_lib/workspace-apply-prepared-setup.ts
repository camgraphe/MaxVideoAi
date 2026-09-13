import type { WorkspaceModelSetup } from './workspace-model-candidate';
export type WorkspaceSetupSetters = {
  [K in keyof WorkspaceModelSetup as `set${Capitalize<K>}`]: (
    value: WorkspaceModelSetup[K],
  ) => void;
};
/** Apply one validated/prepared setup in one React batch, before schema reconciliation. */
export function applyWorkspacePreparedSetup(
  setup: WorkspaceModelSetup,
  setters: WorkspaceSetupSetters,
) {
  const committed = structuredClone(setup);
  setters.setInputAssets(committed.inputAssets);
  setters.setKlingElements(committed.klingElements);
  setters.setPrompt(committed.prompt);
  setters.setNegativePrompt(committed.negativePrompt);
  setters.setMultiPromptEnabled(committed.multiPromptEnabled);
  setters.setMultiPromptScenes(committed.multiPromptScenes);
  setters.setShotType(committed.shotType);
  setters.setVoiceIdsInput(committed.voiceIdsInput);
  setters.setCfgScale(committed.cfgScale);
  setters.setForm(committed.form);
}
