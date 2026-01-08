'use client';

import type { EngineCaps, Mode } from '@/types/engines';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { Chip } from '@/components/ui/Chip';

interface EngineSettingsBarProps {
  engines: EngineCaps[];
  engineId: string;
  onEngineChange: (engineId: string) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  modeOptions?: Mode[];
  modeLabelOverrides?: Partial<Record<Mode, string>>;
  modeLabel?: string;
  showModeBadge?: boolean;
}

export function EngineSettingsBar({
  engines,
  engineId,
  onEngineChange,
  mode,
  onModeChange,
  modeOptions,
  modeLabelOverrides,
  modeLabel,
  showModeBadge = true,
}: EngineSettingsBarProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
      <EngineSelect
        engines={engines}
        engineId={engineId}
        onEngineChange={onEngineChange}
        mode={mode}
        onModeChange={onModeChange}
        modeOptions={modeOptions}
        modeLabelOverrides={modeLabelOverrides}
        showModeSelect={false}
        showBillingNote={false}
        variant="bar"
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
