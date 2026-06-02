import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import type { Mode } from '@/types/engines';

type SettingsEngineAdvancedLayout = 'compact' | 'panel';

type SettingsKlingV3ControlsProps = {
  klingShotType: 'customize' | 'intelligent';
  layout: SettingsEngineAdvancedLayout;
  mode: Mode;
  onKlingShotTypeChange?: (value: 'customize' | 'intelligent') => void;
  onVoiceIdsChange?: (value: string) => void;
  showVoiceControls: boolean;
  voiceControlActive: boolean;
  voiceIdsValue: string;
};

type SettingsSeedanceAdvancedControlsProps = {
  cameraFixed: boolean;
  layout: SettingsEngineAdvancedLayout;
  onCameraFixedChange?: (value: boolean) => void;
  onSafetyCheckerChange?: (value: boolean) => void;
  onSeedChange?: (value: string) => void;
  safetyChecker: boolean;
  seedValue: string;
};

const toggleButtonClass =
  'min-h-0 h-auto px-3 py-1.5 text-[13px]';

function activeToggleClass(active: boolean) {
  return active
    ? 'border-brand bg-brand text-on-brand'
    : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2';
}

export function SettingsKlingV3Controls({
  klingShotType,
  layout,
  mode,
  onKlingShotTypeChange,
  onVoiceIdsChange,
  showVoiceControls,
  voiceControlActive,
  voiceIdsValue,
}: SettingsKlingV3ControlsProps) {
  const isCompact = layout === 'compact';
  const labelClass = isCompact
    ? 'text-[11px] font-semibold uppercase tracking-micro text-text-muted'
    : 'text-[12px] uppercase tracking-micro text-text-muted';
  const fieldClass = isCompact
    ? 'flex flex-col gap-1.5 text-sm text-text-secondary'
    : 'flex flex-col gap-2 text-sm text-text-secondary';
  const inputClass = isCompact
    ? 'h-10 rounded-input border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
    : 'rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  const body = (
    <>
      <label className={fieldClass}>
        <span className={labelClass}>Shot type</span>
        <div className="flex flex-wrap gap-2">
          {(['customize', 'intelligent'] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant="outline"
              disabled={mode === 'i2v'}
              onClick={() => {
                if (mode === 'i2v') return;
                onKlingShotTypeChange?.(option);
              }}
              className={clsx(toggleButtonClass, activeToggleClass(option === klingShotType))}
            >
              {option}
            </Button>
          ))}
        </div>
        {mode === 'i2v' ? (
          <span className="text-[11px] text-text-muted">Shot type is locked to customize for image-to-video.</span>
        ) : null}
      </label>
      {showVoiceControls ? (
        <label className={fieldClass}>
          <span className={labelClass}>Voice IDs (CSV)</span>
          <input
            type="text"
            placeholder="voice_1, voice_2"
            value={voiceIdsValue}
            onChange={(event) => onVoiceIdsChange?.(event.currentTarget.value)}
            className={inputClass}
          />
          <span className="text-[11px] text-text-muted">Voice control pricing: $0.392/s</span>
          {voiceControlActive ? (
            <span className="text-[11px] text-text-muted">Audio locked on while voice control is enabled.</span>
          ) : null}
        </label>
      ) : null}
    </>
  );

  if (isCompact) {
    return (
      <div className="space-y-3">
        <span className={labelClass}>Kling controls</span>
        <div className="grid gap-3 md:grid-cols-2">{body}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className={labelClass}>Kling controls</span>
      <div className="space-y-2 rounded-input border border-border bg-surface p-3">{body}</div>
    </div>
  );
}

export function SettingsSeedanceAdvancedControls({
  cameraFixed,
  layout,
  onCameraFixedChange,
  onSafetyCheckerChange,
  onSeedChange,
  safetyChecker,
  seedValue,
}: SettingsSeedanceAdvancedControlsProps) {
  const isCompact = layout === 'compact';
  const labelClass = isCompact
    ? 'text-[11px] font-semibold uppercase tracking-micro text-text-muted'
    : 'text-[12px] uppercase tracking-micro text-text-muted';
  const fieldClass = isCompact
    ? 'flex flex-col gap-1.5 text-sm text-text-secondary'
    : 'flex flex-col gap-2 text-sm text-text-secondary';
  const inputClass = isCompact
    ? 'h-10 rounded-input border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
    : 'rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  const body = (
    <>
      <label className={fieldClass}>
        <span className={labelClass}>Seed</span>
        <input
          type="number"
          placeholder="-1 for random"
          value={seedValue}
          onChange={(event) => onSeedChange?.(event.currentTarget.value)}
          className={inputClass}
        />
        <span className="text-[11px] text-text-muted">Use -1 for random.</span>
      </label>
      <label className={fieldClass}>
        <span className={labelClass}>Camera fixed</span>
        <div className="flex flex-wrap gap-2">
          {[true, false].map((option) => (
            <Button
              key={option ? 'camera-on' : 'camera-off'}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onCameraFixedChange?.(option)}
              className={clsx(toggleButtonClass, activeToggleClass(option === cameraFixed))}
            >
              {option ? 'On' : 'Off'}
            </Button>
          ))}
        </div>
      </label>
      <label className={fieldClass}>
        <span className={labelClass}>Safety checker</span>
        <div className="flex flex-wrap gap-2">
          {[true, false].map((option) => (
            <Button
              key={option ? 'safety-on' : 'safety-off'}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onSafetyCheckerChange?.(option)}
              className={clsx(toggleButtonClass, activeToggleClass(option === safetyChecker))}
            >
              {option ? 'On' : 'Off'}
            </Button>
          ))}
        </div>
      </label>
    </>
  );

  if (isCompact) {
    return (
      <div className="space-y-3">
        <span className={labelClass}>Seedance advanced</span>
        <div className="grid gap-3 md:grid-cols-3">{body}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className={labelClass}>Seedance advanced</span>
      <div className="space-y-3 rounded-input border border-border bg-surface p-3">{body}</div>
    </div>
  );
}
