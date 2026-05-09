import type {
  CharacterBuilderRequest,
  CharacterBuilderSettingsSnapshot,
} from '@/types/character-builder';

export function buildSettingsSnapshot(
  request: CharacterBuilderRequest,
  prompt: string,
  engineId: string,
  engineLabel: string,
  inputMode: 't2i' | 'i2i'
): CharacterBuilderSettingsSnapshot {
  return {
    schemaVersion: 1,
    surface: 'character-builder',
    action: request.action,
    engineId,
    engineLabel,
    inputMode,
    prompt,
    builder: {
      sourceMode: request.sourceMode,
      outputMode: request.outputMode,
      consistencyMode: request.consistencyMode,
      referenceStrength: request.referenceStrength ?? null,
      qualityMode: request.qualityMode,
      formatMode: request.formatMode,
      referenceImages: request.referenceImages,
      traits: request.traits,
      outputOptions: request.outputOptions,
      advancedNotes: request.advancedNotes ?? '',
      mustRemainVisible: request.mustRemainVisible ?? [],
    },
    lineage: {
      parentResultId: request.lineage?.parentResultId ?? request.selectedResultId ?? null,
      parentRunId: request.lineage?.parentRunId ?? null,
      pinnedReferenceResultId:
        request.lineage?.pinnedReferenceResultId ?? request.pinnedReferenceResultId ?? null,
    },
  };
}
