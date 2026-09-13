import type { AssetFieldConfig } from '@/components/Composer';
import { getSeedanceFieldBlockKey } from '@/lib/seedance-workflow';
import { getGeminiOmniAssetFieldDisabledReason, getGeminiOmniAssetState, hasGeminiOmniPreviousInteraction } from './gemini-omni-unified-workflow';
import type { ReferenceAsset } from './workspace-assets';
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
  workflowCopy: { clearReferencesToUseStartEnd: string; clearStartEndToUseReferences: string };
  showOmniStudioPanel: boolean;
  previousInteractionId?: unknown;
  showLumaRay32KeyframeEditor: boolean;
};
const LUMA_CUSTOM_ASSETS = new Set(['video_url', 'start_image_url', 'edit_keyframe_urls']);

/** Shared availability for the composer and recent-reference destination chooser. */
export function getWorkspaceReferenceFields(fields: AssetFieldConfig[], options: WorkspaceReferenceAvailability): AssetFieldConfig[] {
  const { inputAssets, isUnifiedSeedance, isUnifiedKlingO3, klingO3VideoToVideoSupported, hasAnyVideoInput,
    guestUploadLockedReason, workflowCopy, showOmniStudioPanel, showLumaRay32KeyframeEditor } = options;
  return fields.filter(({ field }) => !(showLumaRay32KeyframeEditor && LUMA_CUSTOM_ASSETS.has(field.id))).map((entry) => {
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
      const derivedDisabledReason = omniDisabledReason ?? klingO3DisabledReason ?? workflowDisabledReason ?? guestUploadLockedReason;
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
