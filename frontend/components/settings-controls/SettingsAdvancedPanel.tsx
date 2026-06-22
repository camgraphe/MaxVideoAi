'use client';

import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import {
  SettingsKlingV3Controls,
  SettingsSeedanceAdvancedControls,
} from '@/components/settings-controls/settings-control-engine-advanced';
import { SettingsGenericAdvancedFields } from '@/components/settings-controls/settings-control-generic-fields';
import { RangeWithInput } from '@/components/settings-controls/settings-control-parts';
import type { SettingsControlsProps } from '@/components/settings-controls/settings-control-types';
import type { useSettingsControlState } from '@/components/settings-controls/useSettingsControlState';

type SettingsControlState = ReturnType<typeof useSettingsControlState>;

type SettingsAdvancedPanelProps = Pick<
  SettingsControlsProps,
  | 'advancedFieldValues'
  | 'advancedFields'
  | 'cameraFixed'
  | 'engine'
  | 'klingShotType'
  | 'loopEnabled'
  | 'mode'
  | 'onAdvancedFieldChange'
  | 'onCameraFixedChange'
  | 'onCfgScaleChange'
  | 'onKlingShotTypeChange'
  | 'onLoopChange'
  | 'onSafetyCheckerChange'
  | 'onSeedChange'
  | 'onSeedLockedChange'
  | 'onVoiceIdsChange'
  | 'safetyChecker'
  | 'seedLocked'
  | 'seedValue'
  | 'showExtendControl'
  | 'showKlingV3Controls'
  | 'showKlingV3VoiceControls'
  | 'showLoopControl'
  | 'showSafetyCheckerControl'
  | 'showSeedanceControls'
  | 'voiceControlActive'
  | 'voiceIdsValue'
> & {
  panelVariant: 'standalone' | 'embedded';
  state: SettingsControlState;
};

function AdvancedToggle({
  className,
  isOpen,
  label,
  onClick,
  titleClassName,
}: {
  className: string;
  isOpen: boolean;
  label: string;
  onClick: () => void;
  titleClassName: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={className}
      onClick={onClick}
      aria-expanded={isOpen}
    >
      <span className={titleClassName}>{label}</span>
      <svg
        className={clsx('h-4 w-4 text-text-muted transition-transform', isOpen ? 'rotate-180' : 'rotate-0')}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Button>
  );
}

function LoopModeControl({
  copy,
  loopEnabled,
  onLoopChange,
}: {
  copy: SettingsControlState['controlsCopy']['loop'];
  loopEnabled: boolean;
  onLoopChange: (value: boolean) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{copy.label}</span>
        <div className="flex flex-wrap gap-2">
          {[true, false].map((option) => (
            <Button
              key={option ? 'loop-on' : 'loop-off'}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onLoopChange(option)}
              className={clsx(
                'min-h-0 h-auto px-2.5 py-1 text-[12px]',
                option === loopEnabled
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2'
              )}
            >
              {option ? copy.on : copy.off}
            </Button>
          ))}
        </div>
      </label>
    </div>
  );
}

function StandaloneSeedControls({
  engine,
  mode,
  safetyChecker,
  seedLocked,
  seedValue,
  showSafetyCheckerControl,
  state,
  onSafetyCheckerChange,
  onSeedChange,
  onSeedLockedChange,
}: Pick<
  SettingsAdvancedPanelProps,
  | 'engine'
  | 'mode'
  | 'onSafetyCheckerChange'
  | 'onSeedChange'
  | 'onSeedLockedChange'
  | 'safetyChecker'
  | 'seedLocked'
  | 'seedValue'
  | 'showSafetyCheckerControl'
> & {
  state: SettingsControlState;
}) {
  const { controlsCopy, seed, setSeed } = state;
  const seedField = [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])].find((field) => {
    if (field.id !== 'seed') return false;
    return !field.modes || field.modes.includes(mode);
  });

  return (
    <div className="grid gap-3 md:grid-cols-3 md:items-end">
      <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
        <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{controlsCopy.seed.label}</span>
        <input
          type="number"
          min={seedField?.min}
          max={seedField?.max}
          step={seedField?.step ?? 1}
          placeholder={controlsCopy.seed.placeholder}
          value={onSeedChange ? seedValue : seed}
          onChange={(event) => {
            setSeed(event.currentTarget.value);
            onSeedChange?.(event.currentTarget.value);
          }}
          className="h-10 rounded-input border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <label className="inline-flex min-h-[40px] items-center gap-2 text-[13px] text-text-secondary">
        <input
          type="checkbox"
          checked={Boolean(seedLocked)}
          onChange={(event) => onSeedLockedChange?.(event.currentTarget.checked)}
        />
        <span>{controlsCopy.seed.lock}</span>
      </label>
      {showSafetyCheckerControl ? (
        <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
          <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">Safety checker</span>
          <div className="flex flex-wrap gap-2">
            {[true, false].map((option) => (
              <Button
                key={option ? 'generic-safety-on' : 'generic-safety-off'}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onSafetyCheckerChange?.(option)}
                className={clsx(
                  'min-h-0 h-auto px-3 py-1.5 text-[13px]',
                  option === safetyChecker
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2'
                )}
              >
                {option ? 'On' : 'Off'}
              </Button>
            ))}
          </div>
        </label>
      ) : null}
    </div>
  );
}

function EmbeddedSeedControls({
  engine,
  mode,
  seedLocked,
  state,
  onSeedLockedChange,
}: Pick<SettingsAdvancedPanelProps, 'engine' | 'mode' | 'onSeedLockedChange' | 'seedLocked'> & {
  state: SettingsControlState;
}) {
  const { controlsCopy, seed, setSeed } = state;
  const seedField = [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])].find((field) => {
    if (field.id !== 'seed') return false;
    return !field.modes || field.modes.includes(mode);
  });

  return (
    <>
      <label className="flex flex-col gap-2 text-sm text-text-secondary">
        <span className="text-[12px] uppercase tracking-micro text-text-muted">{controlsCopy.seed.label}</span>
        <input
          type="number"
          min={seedField?.min}
          max={seedField?.max}
          step={seedField?.step ?? 1}
          placeholder={controlsCopy.seed.placeholder}
          value={seed}
          onChange={(event) => setSeed(event.currentTarget.value)}
          className="rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <label className="inline-flex items-center gap-2 text-[13px] text-text-secondary">
        <input
          type="checkbox"
          checked={Boolean(seedLocked)}
          onChange={(event) => onSeedLockedChange?.(event.currentTarget.checked)}
        />
        <span>{controlsCopy.seed.lock}</span>
      </label>
    </>
  );
}

function AdvancedRangeFields({
  labelClassName,
  state,
  props,
}: {
  labelClassName: string;
  state: SettingsControlState;
  props: SettingsAdvancedPanelProps;
}) {
  const { controlsCopy, effectiveCfgScale, guidance, initInfluence, promptStrength } = state;
  const { engine, mode, onCfgScaleChange } = props;

  return (
    <>
      {engine.params.promptStrength ? (
        <div className="space-y-2">
          <span className={labelClassName}>{controlsCopy.promptStrength}</span>
          <RangeWithInput
            value={promptStrength ?? engine.params.promptStrength.default ?? 0.5}
            min={engine.params.promptStrength.min ?? 0}
            max={engine.params.promptStrength.max ?? 1}
            step={engine.params.promptStrength.step ?? 0.05}
            onChange={(value) => state.setPromptStrength(value)}
          />
        </div>
      ) : null}

      {engine.params.guidance ? (
        <div className="space-y-2">
          <span className={labelClassName}>{controlsCopy.guidance}</span>
          <RangeWithInput
            value={guidance ?? engine.params.guidance.default ?? 0.5}
            min={engine.params.guidance.min ?? 0}
            max={engine.params.guidance.max ?? 1}
            step={engine.params.guidance.step ?? 0.05}
            onChange={(value) => state.setGuidance(value)}
          />
        </div>
      ) : null}

      {mode === 'i2v' && engine.params.initInfluence ? (
        <div className="space-y-2">
          <span className={labelClassName}>{controlsCopy.inputInfluence}</span>
          <RangeWithInput
            value={initInfluence ?? engine.params.initInfluence.default ?? 0.5}
            min={engine.params.initInfluence.min ?? 0}
            max={engine.params.initInfluence.max ?? 1}
            step={engine.params.initInfluence.step ?? 0.05}
            onChange={(value) => state.setInitInfluence(value)}
          />
        </div>
      ) : null}

      {engine.params.cfg_scale ? (
        <div className="space-y-2">
          <span className={labelClassName}>{controlsCopy.cfgScale}</span>
          <RangeWithInput
            value={effectiveCfgScale}
            min={engine.params.cfg_scale.min ?? 0}
            max={engine.params.cfg_scale.max ?? 1}
            step={engine.params.cfg_scale.step ?? 0.01}
            onChange={(value) => {
              if (onCfgScaleChange) {
                onCfgScaleChange(value);
              } else {
                state.setInternalCfgScale(value);
              }
            }}
          />
        </div>
      ) : null}
    </>
  );
}

function ExtendAndKeyframeControls({
  labelClassName,
  props,
  state,
}: {
  labelClassName: string;
  props: SettingsAdvancedPanelProps;
  state: SettingsControlState;
}) {
  const { controlsCopy } = state;
  const { engine, showExtendControl } = props;

  return (
    <>
      {showExtendControl && engine.extend ? (
        <div className="space-y-2">
          <span className={labelClassName}>{controlsCopy.extend.label}</span>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-secondary">
            <span>{controlsCopy.extend.action}</span>
            <input
              type="number"
              min={1}
              max={30}
              defaultValue={5}
              className="h-10 w-20 rounded-input border border-border bg-surface px-2 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span>{controlsCopy.extend.unit}</span>
          </div>
        </div>
      ) : null}

      {engine.keyframes ? <div className="text-[12px] text-text-muted">{controlsCopy.keyframes}</div> : null}
    </>
  );
}

function EngineAdvancedControls({
  layout,
  props,
}: {
  layout: 'compact' | 'panel';
  props: SettingsAdvancedPanelProps;
}) {
  const {
    cameraFixed,
    klingShotType,
    mode,
    onCameraFixedChange,
    onKlingShotTypeChange,
    onSafetyCheckerChange,
    onSeedChange,
    onVoiceIdsChange,
    safetyChecker,
    seedValue,
    showKlingV3Controls,
    showKlingV3VoiceControls,
    showSeedanceControls,
    voiceControlActive,
    voiceIdsValue,
  } = props;

  return (
    <>
      {showKlingV3Controls ? (
        <SettingsKlingV3Controls
          klingShotType={klingShotType ?? 'customize'}
          layout={layout}
          mode={mode}
          onKlingShotTypeChange={onKlingShotTypeChange}
          onVoiceIdsChange={onVoiceIdsChange}
          showVoiceControls={showKlingV3VoiceControls ?? true}
          voiceControlActive={voiceControlActive ?? false}
          voiceIdsValue={voiceIdsValue ?? ''}
        />
      ) : null}

      {showSeedanceControls ? (
        <SettingsSeedanceAdvancedControls
          cameraFixed={cameraFixed ?? false}
          layout={layout}
          onCameraFixedChange={onCameraFixedChange}
          onSafetyCheckerChange={onSafetyCheckerChange}
          onSeedChange={onSeedChange}
          safetyChecker={safetyChecker ?? true}
          seedValue={seedValue ?? ''}
        />
      ) : null}
    </>
  );
}

function AdvancedContent(props: SettingsAdvancedPanelProps) {
  const { panelVariant, showLoopControl, loopEnabled, onLoopChange, showSeedanceControls, state } = props;
  const labelClassName =
    panelVariant === 'standalone'
      ? 'text-[11px] font-semibold uppercase tracking-micro text-text-muted'
      : 'text-[12px] uppercase tracking-micro text-text-muted';

  return (
    <>
      {panelVariant === 'standalone' && showLoopControl && typeof loopEnabled === 'boolean' && onLoopChange ? (
        <LoopModeControl copy={state.controlsCopy.loop} loopEnabled={loopEnabled} onLoopChange={onLoopChange} />
      ) : null}

      {!showSeedanceControls && panelVariant === 'standalone' ? <StandaloneSeedControls {...props} /> : null}
      {!showSeedanceControls && panelVariant === 'embedded' ? <EmbeddedSeedControls {...props} /> : null}

      <AdvancedRangeFields labelClassName={labelClassName} state={state} props={props} />
      <ExtendAndKeyframeControls labelClassName={labelClassName} state={state} props={props} />

      {panelVariant === 'standalone' && state.hasGenericAdvancedFields ? (
        <SettingsGenericAdvancedFields
          fields={props.advancedFields ?? []}
          values={props.advancedFieldValues ?? {}}
          onChange={props.onAdvancedFieldChange}
        />
      ) : null}

      <EngineAdvancedControls layout={panelVariant === 'standalone' ? 'compact' : 'panel'} props={props} />
    </>
  );
}

export function SettingsAdvancedPanel(props: SettingsAdvancedPanelProps) {
  const { panelVariant, state } = props;
  const { advancedHasContent, controlsCopy, isAdvancedOpen, setIsAdvancedOpen } = state;

  if (panelVariant === 'standalone') {
    if (!advancedHasContent) return null;

    return (
      <div className="space-y-3">
        <AdvancedToggle
          className="min-h-0 h-auto w-full justify-between px-0 py-0 text-left font-normal"
          isOpen={isAdvancedOpen}
          label={controlsCopy.advancedTitle}
          onClick={() => setIsAdvancedOpen((prev) => !prev)}
          titleClassName="text-[11px] font-semibold uppercase tracking-micro text-text-muted"
        />
        {isAdvancedOpen ? (
          <div className="space-y-4 rounded-input border border-border bg-surface-glass-60 p-3">
            <AdvancedContent {...props} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-input border border-border bg-surface">
      <AdvancedToggle
        className="min-h-0 h-auto w-full justify-between px-3 py-2 text-left font-normal"
        isOpen={isAdvancedOpen}
        label={controlsCopy.advancedTitle}
        onClick={() => setIsAdvancedOpen((prev) => !prev)}
        titleClassName="text-[12px] font-semibold uppercase tracking-micro text-text-muted"
      />
      {isAdvancedOpen ? (
        <div className="stack-gap-sm border-t border-border px-3 pb-3 pt-2">
          <AdvancedContent {...props} />
        </div>
      ) : null}
    </div>
  );
}
