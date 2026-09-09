import {
  createDefaultCharacterBuilderState,
  normalizeCharacterFormatMode,
  normalizeTraitsForSourceMode,
} from '@/lib/character-builder';
import type {
  CharacterBuilderFormatMode,
  CharacterBuilderSourceMode,
} from '@/types/character-builder';
import type {
  WorkspaceShotSettings,
  WorkspaceToolSettings,
} from './workspace-types';

export type WorkspaceCharacterBuilderSettings = NonNullable<WorkspaceToolSettings['characterBuilder']>;

function normalizeGenerateCount(value: unknown): 1 | 4 {
  return value === 4 ? 4 : 1;
}

function normalizeReferenceStrength(value: unknown): WorkspaceCharacterBuilderSettings['referenceStrength'] {
  if (value === 'loose' || value === 'strong') return value;
  return 'balanced';
}

export function createWorkspaceCharacterBuilderSettings(
  sourceMode: CharacterBuilderSourceMode = 'scratch'
): WorkspaceCharacterBuilderSettings {
  const defaults = createDefaultCharacterBuilderState(sourceMode);
  return {
    outputMode: defaults.outputMode,
    consistencyMode: defaults.consistencyMode,
    referenceStrength: defaults.referenceStrength ?? 'balanced',
    qualityMode: defaults.qualityMode,
    formatMode: defaults.formatMode,
    traits: defaults.traits,
    outputOptions: defaults.outputOptions,
    advancedNotes: defaults.advancedNotes,
    mustRemainVisible: defaults.mustRemainVisible,
    generateCount: 1,
  };
}

export function normalizeWorkspaceCharacterBuilderSettings(
  value: WorkspaceToolSettings['characterBuilder'] | undefined,
  sourceMode: CharacterBuilderSourceMode = 'scratch'
): WorkspaceCharacterBuilderSettings {
  const defaults = createWorkspaceCharacterBuilderSettings(sourceMode);
  const record: Partial<WorkspaceCharacterBuilderSettings> = value && typeof value === 'object' ? value : {};
  const qualityMode = record.qualityMode === 'final' ? 'final' : 'draft';
  const formatMode = normalizeCharacterFormatMode(
    record.formatMode as CharacterBuilderFormatMode | null | undefined,
    qualityMode
  );

  return {
    outputMode: record.outputMode === 'character-sheet' ? 'character-sheet' : defaults.outputMode,
    consistencyMode:
      record.consistencyMode === 'exploratory' || record.consistencyMode === 'strict'
        ? record.consistencyMode
        : defaults.consistencyMode,
    referenceStrength: normalizeReferenceStrength(record.referenceStrength),
    qualityMode,
    formatMode,
    traits: normalizeTraitsForSourceMode(record.traits ?? defaults.traits, sourceMode),
    outputOptions: {
      ...defaults.outputOptions,
      ...(record.outputOptions ?? {}),
    },
    advancedNotes: typeof record.advancedNotes === 'string' ? record.advancedNotes : defaults.advancedNotes,
    mustRemainVisible: Array.isArray(record.mustRemainVisible)
      ? record.mustRemainVisible.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : defaults.mustRemainVisible,
    generateCount: normalizeGenerateCount(record.generateCount),
  };
}

export function normalizeWorkspaceShotToolSettings(settings: WorkspaceShotSettings): WorkspaceShotSettings {
  if (settings.toolKind !== 'character-builder') return settings;
  return {
    ...settings,
    toolSettings: {
      ...settings.toolSettings,
      characterBuilder: normalizeWorkspaceCharacterBuilderSettings(settings.toolSettings?.characterBuilder),
    },
  };
}
