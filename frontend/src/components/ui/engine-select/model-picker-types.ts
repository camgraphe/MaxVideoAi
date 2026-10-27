import type { Mode } from '@/types/engines';
import type { ModelEstimate } from '@/lib/model-picker-estimates';

export type PickerChange = { label: string; before: string; after: string };
export type PickerEstimateRequest = { key: string; load: () => Promise<ModelEstimate> };
export type EnginePickerOption = {
  summary: string;
  changes: PickerChange[];
  disabledReason?: string;
  priceUnavailableReason?: string;
  estimate?: PickerEstimateRequest;
};
export type PickerControl = { id: string; label: string; value: string; options?: { value: string; label: string }[] };
export type EnginePickerContext = {
  controls?: PickerControl[];
  scenarioKey?: string;
  hasChanges?: boolean;
  onControlChange?: (id: string, value: string) => void;
  onApply?: (id: string) => boolean;
  /** Account and immutable draft context; never displayed or logged. */
  key: string;
  scope: string;
  label: string;
  mode: Mode;
  options: Record<string, EnginePickerOption>;
  onOpenChange?: (open: boolean) => void;
};
