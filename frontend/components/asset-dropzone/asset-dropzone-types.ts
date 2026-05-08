import type { ReactNode } from 'react';
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

export type AssetFieldConfig = {
  field: EngineInputField;
  required: boolean;
  role?: AssetFieldRole;
  headerAction?: ReactNode;
  disabled?: boolean;
  disabledReason?: string | null;
};

export type AssetUploadMeta = {
  durationSec?: number;
};
