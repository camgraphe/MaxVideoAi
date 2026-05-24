import type { Ref, ReactNode } from 'react';
import type { EngineCaps, EngineInputField, EngineModeUiCaps as CapabilityCaps, Mode, PreflightResponse } from '@/types/engines';
import type {
  AssetFieldConfig,
  AssetFieldRole,
  AssetSlotAttachment,
  AssetUploadMeta,
} from '@/components/AssetDropzone';

export type ComposerAttachment = AssetSlotAttachment;
export type { AssetFieldConfig, AssetFieldRole, AssetUploadMeta };

export type MultiPromptScene = {
  id: string;
  prompt: string;
  duration: number;
};

export type ComposerModeToggle = {
  mode: Mode | null;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
};

export type ComposerPromotedAction = {
  id: string;
  label: string;
  tooltip?: string;
  active: boolean;
  icon: 'sparkles' | 'shield';
  onToggle: () => void;
  disabled?: boolean;
};

export interface ComposerProps {
  engine: EngineCaps;
  caps?: CapabilityCaps;
  prompt: string;
  onPromptChange: (value: string) => void;
  negativePrompt?: string;
  onNegativePromptChange?: (value: string) => void;
  price: number | null;
  currency: string;
  isLoading: boolean;
  error?: string;
  messages?: string[];
  textareaRef?: Ref<HTMLTextAreaElement>;
  onOpenPromptAssistant?: () => void;
  onGenerate?: () => void;
  iterations?: number;
  preflight?: PreflightResponse | null;
  promptField?: EngineInputField;
  promptRequired: boolean;
  promptPlaceholder?: string;
  promptPlaceholderWithAsset?: string;
  negativePromptField?: EngineInputField;
  negativePromptRequired?: boolean;
  assetFields: AssetFieldConfig[];
  assets: Record<string, (ComposerAttachment | null)[]>;
  onAssetAdd?: (field: EngineInputField, file: File, slotIndex?: number, meta?: AssetUploadMeta) => void;
  onAssetRemove?: (field: EngineInputField, index: number) => void;
  onNotice?: (message: string) => void;
  onOpenLibrary?: (field: EngineInputField, slotIndex: number) => void;
  onAssetUrlSelect?: (field: EngineInputField, url: string, slotIndex: number) => void;
  settingsBar?: ReactNode;
  modeToggles?: ComposerModeToggle[];
  activeManualMode?: Mode | null;
  onModeToggle?: (mode: Mode | null) => void;
  promotedActions?: ComposerPromotedAction[];
  multiPrompt?: {
    enabled: boolean;
    scenes: MultiPromptScene[];
    totalDurationSec: number;
    minDurationSec: number;
    maxDurationSec: number;
    onToggle: (enabled: boolean) => void;
    onAddScene: () => void;
    onRemoveScene: (id: string) => void;
    onUpdateScene: (id: string, patch: Partial<Pick<MultiPromptScene, 'prompt' | 'duration'>>) => void;
    error?: string | null;
  } | null;
  extraFields?: ReactNode;
  afterAssets?: ReactNode;
  disableGenerate?: boolean;
  workflowNotice?: string | null;
  generateLabel?: string;
  generateLoadingLabel?: string;
}
