import type { CharacterBuilderRequest } from '@/types/character-builder';
import type { WorkspaceShotSettings } from './workspace-types';
import { normalizeWorkspaceCharacterBuilderSettings } from './workspace-tool-settings';

type BuildWorkspaceCharacterBuilderRequestInput = {
  settings: WorkspaceShotSettings;
  prompt: string;
  identityImageUrls: string[];
  styleImageUrls: string[];
  jobId?: string | null;
};

function mergeNotes(primary: string, secondary: string): string {
  return [primary.trim(), secondary.trim()].filter(Boolean).join('\n\n');
}

export function buildWorkspaceCharacterBuilderRequest({
  settings,
  prompt,
  identityImageUrls,
  styleImageUrls,
  jobId,
}: BuildWorkspaceCharacterBuilderRequestInput): CharacterBuilderRequest {
  const sourceMode = identityImageUrls.length ? 'reference-image' : 'scratch';
  const characterSettings = normalizeWorkspaceCharacterBuilderSettings(
    settings.toolSettings?.characterBuilder,
    sourceMode
  );
  const referenceImages: CharacterBuilderRequest['referenceImages'] = [
    ...identityImageUrls.slice(0, 2).map((url, index) => ({
      id: `studio-character-identity-${index + 1}`,
      url,
      role: 'identity' as const,
      name: `Identity ${index + 1}`,
    })),
    ...styleImageUrls.slice(0, Math.max(0, 2 - identityImageUrls.length)).map((url, index) => ({
      id: `studio-character-style-${index + 1}`,
      url,
      role: 'style' as const,
      name: `Style ${index + 1}`,
    })),
  ];

  return {
    jobId: jobId ?? null,
    action: 'generate',
    sourceMode,
    outputMode: characterSettings.outputMode,
    consistencyMode: characterSettings.consistencyMode,
    referenceStrength: sourceMode === 'reference-image' ? characterSettings.referenceStrength : null,
    qualityMode: characterSettings.qualityMode,
    formatMode: characterSettings.formatMode,
    referenceImages,
    traits: characterSettings.traits,
    outputOptions: characterSettings.outputOptions,
    advancedNotes: mergeNotes(characterSettings.advancedNotes, prompt),
    mustRemainVisible: characterSettings.mustRemainVisible,
    generateCount: characterSettings.generateCount,
    selectedResultId: null,
    selectedResultUrl: null,
    pinnedReferenceResultId: null,
    pinnedReferenceResultUrl: null,
    lineage: {
      parentResultId: null,
      parentRunId: null,
      pinnedReferenceResultId: null,
    },
  };
}
