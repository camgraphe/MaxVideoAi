import type { FalEngineEntry } from '@/config/falEngines';
import type { EngineCaps, Mode } from '@/types/engines';

export type EngineRegistryMeta = {
  order: Map<string, number>;
  meta: Map<string, FalEngineEntry>;
};

export interface EngineSelectProps {
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
  className?: string;
}

export interface DropdownPosition {
  top: number;
  left: number;
  width: number;
}
