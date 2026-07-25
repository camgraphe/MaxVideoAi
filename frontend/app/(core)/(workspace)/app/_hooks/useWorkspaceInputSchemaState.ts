import { useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { resolveEngineReferenceBudget } from '@/lib/reference-budget';
import { SEEDANCE_REFERENCE_AUDIO_FIELD_IDS } from '@/lib/seedance-workflow';
import type { EngineCaps, Mode } from '@/types/engines';
import {
  buildAssetFieldIdSet,
  buildReferenceAudioFieldIds,
  getPrimaryAssetFieldLabel,
  reconcileReferenceAssets,
  revokeAssetPreview,
  type ReferenceAsset,
} from '../_lib/workspace-assets';
import type { FormState } from '../_lib/workspace-form-state';
import { summarizeWorkspaceInputSchema } from '../_lib/workspace-input-schema';

type UseWorkspaceInputSchemaStateOptions = {
  selectedEngine: EngineCaps | null;
  activeMode: Mode;
  submissionMode: Mode;
  allowsUnifiedVeoFirstLast: boolean;
  isUnifiedHappyHorse: boolean;
  isUnifiedSeedance: boolean;
  isUnifiedGeminiOmni: boolean;
  uiLocale: string;
  authChecked: boolean;
  authLoading: boolean;
  authenticatedUserId?: string | null;
  uploadLockedCopy: string;
  setInputAssets: Dispatch<SetStateAction<Record<string, (ReferenceAsset | null)[]>>>;
  setForm: Dispatch<SetStateAction<FormState | null>>;
};

export function useWorkspaceInputSchemaState({
  selectedEngine,
  activeMode,
  submissionMode,
  allowsUnifiedVeoFirstLast,
  isUnifiedHappyHorse,
  isUnifiedSeedance,
  isUnifiedGeminiOmni,
  uiLocale,
  authChecked,
  authLoading,
  authenticatedUserId,
  uploadLockedCopy,
  setInputAssets,
  setForm,
}: UseWorkspaceInputSchemaStateOptions) {
  const inputSchemaSummary = useMemo(
    () =>
      summarizeWorkspaceInputSchema({
        selectedEngine,
        activeMode,
        allowsUnifiedVeoFirstLast,
        isUnifiedHappyHorse,
        isUnifiedSeedance,
        isUnifiedGeminiOmni,
        uiLocale,
      }),
    [
      activeMode,
      allowsUnifiedVeoFirstLast,
      isUnifiedGeminiOmni,
      isUnifiedHappyHorse,
      isUnifiedSeedance,
      selectedEngine,
      uiLocale,
    ]
  );

  const extraInputFields = useMemo(
    () => [...inputSchemaSummary.promotedFields, ...inputSchemaSummary.secondaryFields],
    [inputSchemaSummary.promotedFields, inputSchemaSummary.secondaryFields]
  );

  useEffect(() => {
    setForm((current) => {
      if (!current) return current;
      const allowedFieldIds = new Set(extraInputFields.map(({ field }) => field.id));
      const nextExtraInputValues = Object.entries(current.extraInputValues).reduce<Record<string, unknown>>(
        (acc, [key, value]) => {
          if (allowedFieldIds.has(key)) {
            acc[key] = value;
          }
          return acc;
        },
        {}
      );
      if (JSON.stringify(nextExtraInputValues) === JSON.stringify(current.extraInputValues)) {
        return current;
      }
      return { ...current, extraInputValues: nextExtraInputValues };
    });
  }, [extraInputFields, setForm]);

  useEffect(() => {
    const activeFields = inputSchemaSummary.assetFields.map((entry) => entry.field);
    const referenceBudget = resolveEngineReferenceBudget(
      selectedEngine?.inputSchema,
      submissionMode
    );
    setInputAssets((previous) =>
      reconcileReferenceAssets(
        previous,
        activeFields,
        referenceBudget,
        revokeAssetPreview
      )
    );
  }, [
    inputSchemaSummary.assetFields,
    selectedEngine?.inputSchema,
    setInputAssets,
    submissionMode,
  ]);

  const primaryAssetFieldIds = useMemo(
    () => buildAssetFieldIdSet(inputSchemaSummary.assetFields, (entry) => entry.role === 'primary'),
    [inputSchemaSummary.assetFields]
  );

  const referenceAssetFieldIds = useMemo(
    () => buildAssetFieldIdSet(inputSchemaSummary.assetFields, (entry) => entry.role === 'reference'),
    [inputSchemaSummary.assetFields]
  );

  const genericImageFieldIds = useMemo(
    () =>
      buildAssetFieldIdSet(
        inputSchemaSummary.assetFields,
        (entry) => entry.role === 'generic' && entry.field.type === 'image'
      ),
    [inputSchemaSummary.assetFields]
  );

  const frameAssetFieldIds = useMemo(
    () => buildAssetFieldIdSet(inputSchemaSummary.assetFields, (entry) => entry.role === 'frame'),
    [inputSchemaSummary.assetFields]
  );

  const referenceAudioFieldIds = useMemo(
    () => buildReferenceAudioFieldIds(inputSchemaSummary.assetFields, SEEDANCE_REFERENCE_AUDIO_FIELD_IDS),
    [inputSchemaSummary.assetFields]
  );

  const primaryAssetFieldLabel = useMemo(
    () => getPrimaryAssetFieldLabel(inputSchemaSummary.assetFields),
    [inputSchemaSummary.assetFields]
  );

  const guestUploadLockedReason =
    !authChecked || (!authLoading && !authenticatedUserId) ? uploadLockedCopy : null;

  return {
    inputSchemaSummary,
    extraInputFields,
    primaryAssetFieldIds,
    referenceAssetFieldIds,
    genericImageFieldIds,
    frameAssetFieldIds,
    referenceAudioFieldIds,
    primaryAssetFieldLabel,
    guestUploadLockedReason,
  };
}
