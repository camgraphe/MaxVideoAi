import type { ReactNode } from 'react';
import type { FalEngineEntry } from '@/config/falEngines';
import type { EngineCaps, Mode } from '@/types/engines';

export type EngineRegistryMeta = {
  order: Map<string, number>;
  meta: Map<string, FalEngineEntry>;
};

export type EngineSelectControlPresentation = 'default' | 'workspace';
export type EngineLaunchBadge = 'new';

export interface EngineSelectProps {
  /** Optional action trigger; reuses the family browser without composer controls. */
  trigger?: { label: string; content: ReactNode; className?: string };
  selectedIds?: string[];
  engines: EngineCaps[];
  engineId: string;
  onEngineChange: (engineId: string) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  modeOptions?: Mode[];
  showBillingNote?: boolean;
  modeLabelOverrides?: Partial<Record<Mode, string>>;
  disabledEngineReasons?: Record<string, string>;
  engineScores?: Record<string, number | null | undefined>;
  showModeSelect?: boolean;
  modeLayout?: 'inline' | 'stacked';
  variant?: 'card' | 'bar';
  density?: 'default' | 'compact';
  controlPresentation?: EngineSelectControlPresentation;
  className?: string;
}

export interface DropdownPosition {
  top: number;
  left: number;
  width: number;
}
