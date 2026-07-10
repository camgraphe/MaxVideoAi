'use client';

import type { EngineCaps, Mode } from '@/types/engines';
import { EngineSelect } from '@/components/ui/EngineSelect';
import type { EngineSelectControlPresentation } from '@/components/ui/engine-select/engine-select-types';
import { Chip } from '@/components/ui/Chip';

interface EngineSettingsBarProps {
  engines: EngineCaps[];
  engineId: string;
  onEngineChange: (engineId: string) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  modeOptions?: Mode[];
  modeLabelOverrides?: Partial<Record<Mode, string>>;
  disabledEngineReasons?: Record<string, string>;
  engineScores?: Record<string, number | null | undefined>;
  modeLabel?: string;
  showModeBadge?: boolean;
  controlPresentation?: EngineSelectControlPresentation;
  density?: 'default' | 'compact';
}

export function EngineSettingsBar({
  engines,
  engineId,
  onEngineChange,
  mode,
  onModeChange,
  modeOptions,
  modeLabelOverrides,
  disabledEngineReasons,
  engineScores,
  modeLabel,
  showModeBadge = true,
  controlPresentation,
  density,
}: EngineSettingsBarProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
      <EngineSelect
        engines={engines}
        engineId={engineId}
        onEngineChange={onEngineChange}
        mode={mode}
        onModeChange={onModeChange}
        modeOptions={modeOptions}
        modeLabelOverrides={modeLabelOverrides}
        disabledEngineReasons={disabledEngineReasons}
        engineScores={engineScores}
        showModeSelect={false}
        showBillingNote={false}
        variant="bar"
        controlPresentation={controlPresentation}
        density={density}
        className="min-w-0 flex-1"
      />
      {showModeBadge && modeLabel ? (
        <Chip variant="outline" className="px-3 py-1 text-[10px] font-semibold tracking-micro text-text-muted normal-case">
          {modeLabel}
        </Chip>
      ) : null}
    </div>
  );
}
