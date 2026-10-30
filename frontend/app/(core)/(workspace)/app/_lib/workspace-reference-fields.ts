import type { AssetFieldConfig } from '@/components/Composer';
import { getSeedanceFieldBlockKey } from '@/lib/seedance-workflow';
import { getGeminiOmniAssetFieldDisabledReason, getGeminiOmniAssetState, hasGeminiOmniPreviousInteraction } from './gemini-omni-unified-workflow';
import type { ReferenceAsset } from './workspace-assets';
import { fieldAcceptsMode, hasMultimodalReferenceFields } from './workspace-multimodal-workflow';
import {
  isKlingO3FrameFieldId,
  KLING_O3_SOURCE_VIDEO_UNSUPPORTED_MESSAGE,
  KLING_O3_VIDEO_FRAME_IGNORED_MESSAGE,
} from './kling-o3-unified-workflow';

export type WorkspaceReferenceAvailability = {
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  isUnifiedSeedance: boolean;
  isUnifiedKlingO3: boolean;
  klingO3VideoToVideoSupported: boolean;
  hasAnyVideoInput: boolean;
  guestUploadLockedReason: string | null;
  workflowCopy: { clearReferencesToUseStartEnd: string; clearStartEndToUseReferences: string; clearIncompatibleMedia?: string };
  showOmniStudioPanel: boolean;
  previousInteractionId?: unknown;
  showLumaRay32KeyframeEditor: boolean;
  showFlux3MaxKeyframeEditor?: boolean;
};

/** Shared availability for the composer and recent-reference destination chooser. */
export function getWorkspaceReferenceFields(fields: AssetFieldConfig[], options: WorkspaceReferenceAvailability): AssetFieldConfig[] {
  const { inputAssets, isUnifiedSeedance, isUnifiedKlingO3, klingO3VideoToVideoSupported, hasAnyVideoInput,
    guestUploadLockedReason, workflowCopy, showOmniStudioPanel, showLumaRay32KeyframeEditor, showFlux3MaxKeyframeEditor } = options;
  const applySchemaCompatibility = !isUnifiedSeedance && !isUnifiedKlingO3 && !showOmniStudioPanel
    && hasMultimodalReferenceFields(fields.map(({ field }) => field));
  const populatedFields = fields.filter(({ field }) =>
    (inputAssets[field.id] ?? []).some((asset) => asset?.kind === field.type));
  return fields.filter(({ field }) => !(showLumaRay32KeyframeEditor && field.id === 'edit_keyframe_urls') && !(showFlux3MaxKeyframeEditor && field.id === 'reference_image_urls')).map((entry) => {
      const fieldHasOwnAssets = (inputAssets[entry.field.id] ?? []).some((asset) => asset != null);
      const blockKey = isUnifiedSeedance
        ? getSeedanceFieldBlockKey(entry.field.id, inputAssets, fieldHasOwnAssets)
        : null;
      const workflowDisabledReason =
        blockKey === 'clearReferences'
          ? workflowCopy.clearReferencesToUseStartEnd
          : blockKey === 'clearStartEnd'
            ? workflowCopy.clearStartEndToUseReferences
            : null;
      const klingO3DisabledReason =
        isUnifiedKlingO3 && entry.field.type === 'video' && entry.field.id === 'video_url' && !klingO3VideoToVideoSupported
          ? KLING_O3_SOURCE_VIDEO_UNSUPPORTED_MESSAGE
          : isUnifiedKlingO3 && hasAnyVideoInput && isKlingO3FrameFieldId(entry.field.id)
            ? KLING_O3_VIDEO_FRAME_IGNORED_MESSAGE
            : null;
      const omniDisabledReason = showOmniStudioPanel
        ? getGeminiOmniAssetFieldDisabledReason(entry.field.id, {
            ...getGeminiOmniAssetState(inputAssets),
            hasPreviousInteraction: hasGeminiOmniPreviousInteraction(options.previousInteractionId),
          })
        : null;
      const incompatibleFields = applySchemaCompatibility && !fieldHasOwnAssets
        && entry.field.modes?.length
        && !entry.field.modes.some((mode) => populatedFields.every(({ field }) => fieldAcceptsMode(field, mode)));
      const schemaDisabledReason = incompatibleFields
        ? entry.role === 'frame' || entry.role === 'primary'
          ? workflowCopy.clearReferencesToUseStartEnd
          : populatedFields.some(({ role }) => role === 'frame' || role === 'primary')
            ? workflowCopy.clearStartEndToUseReferences
            : workflowCopy.clearIncompatibleMedia ?? 'Remove incompatible media before adding this reference.'
        : null;
      const lumaGuideDisabledReason = showLumaRay32KeyframeEditor && entry.field.id === 'start_image_url'
        && inputAssets.edit_keyframe_urls?.some(Boolean)
        ? 'Remove keyframes to use a single guide frame.'
        : null;
      const derivedDisabledReason = omniDisabledReason ?? klingO3DisabledReason ?? lumaGuideDisabledReason ?? workflowDisabledReason ?? schemaDisabledReason ?? guestUploadLockedReason;
      const preservesIncomingRestriction = entry.disabled === true;
      const disabledReason = preservesIncomingRestriction
        ? entry.disabledReason ?? derivedDisabledReason
        : derivedDisabledReason;
    return {
      ...entry,
      disabled: preservesIncomingRestriction || Boolean(derivedDisabledReason),
      disabledReason,
      disabledPresentation: disabledReason && disabledReason === guestUploadLockedReason
        ? 'auth-lock'
        : entry.disabledPresentation ?? 'default',
    };
  });
}
