import type { ChangeEvent, ClipboardEvent, DragEvent, ReactNode } from 'react';
import type { getLocalizedAssetDropzoneCopy } from '@/lib/ltx-localization';
import type { EngineInputField } from '@/types/engines';

export type AssetSlotAttachment = {
  kind: 'image' | 'video' | 'audio';
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  status?: 'uploading' | 'ready' | 'error';
  error?: string;
  badge?: string;
};

export type AssetFieldRole = 'primary' | 'reference' | 'frame' | 'generic';
export type AssetDisabledPresentation = 'default' | 'auth-lock';

export type AssetFieldGuidance = {
  label: string;
  tooltip?: string;
};

export type AssetFieldConfig = {
  field: EngineInputField;
  required: boolean;
  role?: AssetFieldRole;
  headerAction?: ReactNode;
  disabled?: boolean;
  disabledReason?: string | null;
  disabledPresentation?: AssetDisabledPresentation;
  guidance?: AssetFieldGuidance | null;
};

export type AssetUploadMeta = {
  durationSec?: number;
  width?: number;
  height?: number;
};

type AssetDropzoneCopy = ReturnType<typeof getLocalizedAssetDropzoneCopy>;
export type AssetDropzoneSlotProps = {
  accept: string;
  mediaKind?: 'image' | 'video' | 'audio';
  asset: AssetSlotAttachment | null;
  assetCopy: AssetDropzoneCopy;
  canOpenLibrary: boolean;
  compactDensity: boolean;
  compactCollectionLayout: boolean;
  workspaceDensity: boolean;
  disabled: boolean;
  disabledReason: string | null;
  displaySlotCount: number;
  engineId: string;
  filledAssetCount: number;
  fullBleedSingleAsset: boolean;
  hideRequiredSlotCopy: boolean;
  inputRef: (element: HTMLInputElement | null) => void;
  isCollectionField: boolean;
  minCount: number;
  slotIndex: number;
  slotLabel: string;
  onDisabledAttempt: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>, slotIndex: number) => void;
  onInputChange: (event: ChangeEvent<HTMLInputElement>, slotIndex: number) => void;
  onOpenLibrarySlot: (slotIndex: number) => void;
  onPaste: (event: ClipboardEvent<HTMLDivElement>, slotIndex: number) => void;
  onRemoveSlot: (slotIndex: number) => void;
  onSelectFileSlot: (slotIndex: number) => void;
};
