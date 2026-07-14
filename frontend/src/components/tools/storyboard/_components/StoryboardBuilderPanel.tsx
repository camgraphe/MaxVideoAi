/* eslint-disable @next/next/no-img-element */

import type { ReactNode } from 'react';
import { Camera, Clapperboard, Film, ImagePlus, Loader2, Sparkles, Smartphone, UserRound } from 'lucide-react';
import { AssetDropzone, type AssetSlotAttachment } from '@/components/AssetDropzone';
import type { EngineCaps, EngineInputField } from '@/types/engines';
import { isStoryboardTargetRecommended } from '../_lib/storyboard-target';
import {
  STORYBOARD_STYLE_OPTIONS,
  STORYBOARD_TARGET_LOGOS,
  STORYBOARD_TARGET_OPTIONS,
} from '../_lib/storyboard-workspace-config';
import type { StoryboardCopy } from '../_lib/storyboard-workspace-copy';
import type { StoryboardStyle, StoryboardTargetModel } from '../_lib/storyboard-prompt';
import {
  STORYBOARD_LENGTH_PRESETS,
  STORYBOARD_ORIENTATION_OPTIONS,
  STORYBOARD_TIER_OPTIONS,
  type StoryboardLengthPresetId,
  type StoryboardOrientation,
  type StoryboardTier,
} from '../_lib/storyboard-templates';

export type StoryboardOptionalField = 'action' | 'dialogue' | 'visualNotes';

export type StoryboardBuilderPanelProps = {
  copy: StoryboardCopy;
  prompt: {
    subject: string;
    action: string;
    dialogue: string;
    visualNotes: string;
    activeOptionalField: StoryboardOptionalField | null;
    onSubjectChange: (value: string) => void;
    onActionChange: (value: string) => void;
    onDialogueChange: (value: string) => void;
    onVisualNotesChange: (value: string) => void;
    onOptionalFieldToggle: (field: StoryboardOptionalField) => void;
  };
  references: {
    field: EngineInputField;
    engine: EngineCaps;
    assets: Record<string, (AssetSlotAttachment | null)[]>;
    onFile: (field: EngineInputField, file: File, slotIndex?: number) => void | Promise<void>;
    onRemove: (field: EngineInputField, index: number) => void;
    onOpenLibrary: (field: EngineInputField, slotIndex?: number) => void;
    onError: (message: string) => void;
  };
  target: {
    targetModel: StoryboardTargetModel;
    recognizablePeople: boolean;
    style: StoryboardStyle;
    onTargetChange: (target: StoryboardTargetModel) => void;
    onRecognizablePeopleToggle: () => void;
    onStyleChange: (style: StoryboardStyle) => void;
  };
  output: {
    storyboardOrientation: StoryboardOrientation;
    lengthPresetId: StoryboardLengthPresetId;
    storyboardTier: StoryboardTier;
    tierPriceLabels: Record<StoryboardTier, string>;
    onOrientationSelect: (orientation: StoryboardOrientation) => void;
    onLengthPresetSelect: (presetId: StoryboardLengthPresetId) => void;
    onTierChange: (tier: StoryboardTier) => void;
  };
  submission: {
    activePrice: string;
    canRun: boolean;
    running: boolean;
    error: string | null;
    message: string | null;
    onGenerate: () => void;
  };
};

export function StoryboardBuilderPanel({ copy, prompt, references, target, output, submission }: StoryboardBuilderPanelProps) {
  return (
    <section>
      <div className="rounded-[16px] border border-border bg-surface p-3.5 shadow-card dark:border-white/[0.10] dark:bg-surface-glass-90 dark:shadow-[0_22px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="space-y-3.5">
          <BuilderStep title={copy.subjectStepTitle}>
            <label className="relative block">
              <span className="sr-only">{copy.subjectLabel}</span>
              <textarea
                value={prompt.subject}
                onChange={(event) => prompt.onSubjectChange(event.currentTarget.value)}
                placeholder={copy.subjectPlaceholder}
                rows={2}
                className="min-h-[72px] w-full resize-y rounded-[12px] border border-border bg-bg px-4 py-2.5 pr-10 text-sm leading-5 text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-primary dark:border-white/[0.12] dark:bg-white/[0.035] dark:text-white/[0.92] dark:placeholder:text-white/[0.36] dark:focus:border-white/[0.38]"
              />
              <Sparkles className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-text-muted dark:text-white/[0.45]" />
            </label>
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-3">
                <OptionalPromptButton
                  active={prompt.activeOptionalField === 'action'}
                  filled={Boolean(prompt.action.trim())}
                  label={copy.actionLabel}
                  onClick={() => prompt.onOptionalFieldToggle('action')}
                />
                <OptionalPromptButton
                  active={prompt.activeOptionalField === 'dialogue'}
                  filled={Boolean(prompt.dialogue.trim())}
                  label={copy.dialogueLabel}
                  onClick={() => prompt.onOptionalFieldToggle('dialogue')}
                />
                <OptionalPromptButton
                  active={prompt.activeOptionalField === 'visualNotes'}
                  filled={Boolean(prompt.visualNotes.trim())}
                  label={copy.visualNotesLabel}
                  onClick={() => prompt.onOptionalFieldToggle('visualNotes')}
                />
              </div>
              {prompt.activeOptionalField === 'action' ? (
                <label className="block">
                  <span className="sr-only">{copy.actionLabel}</span>
                  <textarea
                    autoFocus
                    value={prompt.action}
                    onChange={(event) => prompt.onActionChange(event.currentTarget.value)}
                    placeholder={copy.actionPlaceholder}
                    rows={3}
                    className="min-h-[76px] w-full resize-y rounded-[10px] border border-border bg-bg px-3 py-2 text-sm leading-5 text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-primary dark:border-white/[0.12] dark:bg-white/[0.035] dark:text-white/[0.92] dark:placeholder:text-white/[0.36] dark:focus:border-white/[0.38]"
                  />
                </label>
              ) : null}
              {prompt.activeOptionalField === 'dialogue' ? (
                <label className="block">
                  <span className="sr-only">{copy.dialogueLabel}</span>
                  <textarea
                    autoFocus
                    value={prompt.dialogue}
                    onChange={(event) => prompt.onDialogueChange(event.currentTarget.value)}
                    placeholder={copy.dialoguePlaceholder}
                    rows={3}
                    className="min-h-[76px] w-full resize-y rounded-[10px] border border-border bg-bg px-3 py-2 text-sm leading-5 text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-primary dark:border-white/[0.12] dark:bg-white/[0.035] dark:text-white/[0.92] dark:placeholder:text-white/[0.36] dark:focus:border-white/[0.38]"
                  />
                </label>
              ) : null}
              {prompt.activeOptionalField === 'visualNotes' ? (
                <label className="block">
                  <span className="sr-only">{copy.visualNotesLabel}</span>
                  <textarea
                    autoFocus
                    value={prompt.visualNotes}
                    onChange={(event) => prompt.onVisualNotesChange(event.currentTarget.value)}
                    placeholder={copy.visualNotesPlaceholder}
                    rows={3}
                    className="min-h-[76px] w-full resize-y rounded-[10px] border border-border bg-bg px-3 py-2 text-sm leading-5 text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-primary dark:border-white/[0.12] dark:bg-white/[0.035] dark:text-white/[0.92] dark:placeholder:text-white/[0.36] dark:focus:border-white/[0.38]"
                  />
                </label>
              ) : null}
            </div>
          </BuilderStep>

          <BuilderGroup>
            <AssetDropzone
              engine={references.engine}
              field={references.field}
              required={false}
              role="reference"
              assets={references.assets[references.field.id] ?? []}
              disabled={submission.running}
              density="compact"
              className="[&>div]:rounded-[12px]"
              onSelect={(field, file, slotIndex) => {
                void references.onFile(field, file, slotIndex);
              }}
              onOpenLibrary={references.onOpenLibrary}
              onRemove={references.onRemove}
              onError={references.onError}
            />
          </BuilderGroup>

          <BuilderGroup>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STORYBOARD_STYLE_OPTIONS.map((option) => (
                <ChoiceButton key={option} active={target.style === option} onClick={() => target.onStyleChange(option)}>
                  <StyleIcon style={option} />
                  {copy.styles[option]}
                </ChoiceButton>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted dark:text-white/[0.50]">{copy.modelStepTitle}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {STORYBOARD_TARGET_OPTIONS.map((option) => (
                  <ChoiceButton
                    key={option}
                    active={target.targetModel === option}
                    className="justify-between px-3"
                    onClick={() => target.onTargetChange(option)}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <StoryboardTargetLogo active={target.targetModel === option} target={option} />
                      <span className="truncate">{option === 'seedance' ? copy.targetSeedance : copy.targetKling}</span>
                    </span>
                    {isStoryboardTargetRecommended(option, target.recognizablePeople) ? (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro ${
                          target.targetModel === option
                            ? 'bg-on-inverse/15 text-on-inverse dark:bg-[#030712]/10 dark:text-[#030712]'
                            : 'bg-surface-2 text-text-secondary dark:bg-white/[0.08] dark:text-white/[0.72]'
                        }`}
                      >
                        {copy.targetRecommendedLabel}
                      </span>
                    ) : null}
                  </ChoiceButton>
                ))}
              </div>
              <button
                type="button"
                aria-pressed={target.recognizablePeople}
                onClick={target.onRecognizablePeopleToggle}
                className={`flex min-h-[38px] w-full items-center justify-between gap-3 rounded-[10px] border px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                  target.recognizablePeople
                    ? 'border-text-primary bg-bg text-text-primary dark:border-white/[0.35] dark:bg-white/[0.08] dark:text-white'
                    : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover hover:text-text-primary dark:border-white/[0.18] dark:bg-white/[0.045] dark:text-white/[0.76] dark:hover:border-white/[0.30] dark:hover:bg-white/[0.075] dark:hover:text-white'
                }`}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <UserRound className="h-4 w-4 shrink-0 dark:text-white/[0.78]" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{copy.recognizablePeopleLabel}</span>
                    <span
                      className={`mt-0.5 block leading-4 ${
                        target.recognizablePeople ? 'text-text-secondary dark:text-white/[0.68]' : 'text-text-secondary dark:text-white/[0.56]'
                      }`}
                    >
                      {copy.recognizablePeopleMeta}
                    </span>
                  </span>
                </span>
                <span
                  className={`h-5 w-9 shrink-0 rounded-full border p-0.5 transition ${
                    target.recognizablePeople
                      ? 'border-text-primary bg-text-primary dark:border-white dark:bg-white'
                      : 'border-border bg-surface-2 dark:border-white/[0.34] dark:bg-white/[0.14]'
                  }`}
                  aria-hidden="true"
                >
                  <span
                    className={`block h-4 w-4 rounded-full shadow-sm transition ${
                      target.recognizablePeople
                        ? 'translate-x-4 bg-surface dark:bg-[#050B14]'
                        : 'translate-x-0 bg-surface dark:bg-white'
                    }`}
                  />
                </span>
              </button>
              <p className="text-xs leading-5 text-text-secondary">
                {target.targetModel === 'seedance'
                  ? copy.targetNotes.seedance
                  : copy.targetNotes.kling}
              </p>
            </div>
          </BuilderGroup>

          <BuilderGroup>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.formatLabel}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {STORYBOARD_ORIENTATION_OPTIONS.map((option) => (
                  <ChoiceButton
                    key={option}
                    active={output.storyboardOrientation === option}
                    className="justify-start px-3 py-2 text-left"
                    onClick={() => output.onOrientationSelect(option)}
                  >
                    {option === 'landscape' ? <Film className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                    <span className="min-w-0">
                      <span className="block truncate">
                        {option === 'landscape' ? copy.landscapeLabel : copy.portraitLabel}
                      </span>
                      <span
                        className={`mt-0.5 block text-xs font-medium ${
                          output.storyboardOrientation === option
                            ? 'text-on-inverse/70 dark:text-[#030712]/70'
                            : 'text-text-secondary dark:text-white/[0.58]'
                        }`}
                      >
                        {option === 'landscape' ? copy.landscapeMeta : copy.portraitMeta}
                      </span>
                    </span>
                  </ChoiceButton>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {STORYBOARD_LENGTH_PRESETS.map((preset) => (
                <LengthPresetButton
                  key={preset.id}
                  active={output.lengthPresetId === preset.id}
                  label={getLengthPresetLabel(copy, preset.id)}
                  meta={getLengthPresetMeta(copy, preset.id)}
                  onClick={() => output.onLengthPresetSelect(preset.id)}
                />
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {STORYBOARD_TIER_OPTIONS.map((tier) => (
                <TierButton
                  key={tier}
                  active={output.storyboardTier === tier}
                  label={getTierLabel(copy, tier)}
                  price={output.tierPriceLabels[tier]}
                  onClick={() => output.onTierChange(tier)}
                />
              ))}
            </div>
          </BuilderGroup>

          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={submission.onGenerate}
              disabled={!submission.canRun}
              className="flex h-11 w-full items-center justify-between rounded-[12px] bg-text-primary px-5 text-sm font-semibold text-on-inverse transition hover:bg-text-primary/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-[#030712] dark:hover:bg-white/[0.92]"
            >
              <span className="inline-flex items-center gap-2">
                {submission.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {submission.running ? copy.generating : copy.generate}
              </span>
              <span>{submission.activePrice}</span>
            </button>
            <p className="mt-2 text-center text-xs text-text-muted dark:text-white/[0.45]">{copy.generationFootnote}</p>
            {submission.error ? <p className="mt-3 text-sm text-error">{submission.error}</p> : null}
            {submission.message ? <p className="mt-3 text-sm text-success">{submission.message}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function BuilderStep({
  children,
  number,
  title,
}: {
  children: ReactNode;
  number?: number;
  title: string;
}) {
  return (
    <div className="grid gap-2 border-t border-border pt-3.5 first:border-t-0 first:pt-0 dark:border-white/[0.08]">
      <div className="flex items-center gap-2.5">
        {number ? (
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-text-secondary">
            {number}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary dark:text-white/[0.92]">{title}</h2>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function BuilderGroup({ children }: { children: ReactNode }) {
  return <div className="space-y-2 border-t border-border pt-3 dark:border-white/[0.08]">{children}</div>;
}

function OptionalPromptButton({
  active,
  filled,
  label,
  onClick,
}: {
  active: boolean;
  filled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-[38px] items-center justify-between gap-2 rounded-[10px] border px-3 text-xs font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        active
          ? 'border-text-primary bg-text-primary text-on-inverse dark:border-white dark:bg-white dark:text-[#030712]'
          : filled
            ? 'border-text-primary/40 bg-bg text-text-primary dark:border-white/[0.26] dark:bg-white/[0.07] dark:text-white/[0.90]'
            : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover hover:text-text-primary dark:border-white/[0.12] dark:bg-white/[0.035] dark:text-white/[0.66] dark:hover:border-white/[0.22] dark:hover:bg-white/[0.07] dark:hover:text-white'
      }`}
    >
      <span className="truncate">{label}</span>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${filled ? 'bg-current' : 'bg-text-muted/35'}`} />
    </button>
  );
}

function ChoiceButton({
  active,
  children,
  className = '',
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[10px] border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        active
          ? 'border-text-primary bg-text-primary text-on-inverse dark:border-white dark:bg-white dark:text-[#030712]'
          : 'border-border bg-surface text-text-primary hover:border-border-hover hover:bg-surface-hover dark:border-white/[0.12] dark:bg-white/[0.035] dark:text-white/[0.86] dark:hover:border-white/[0.22] dark:hover:bg-white/[0.07] dark:hover:text-white'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function LengthPresetButton({
  active,
  label,
  meta,
  onClick,
}: {
  active: boolean;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[10px] border px-3 py-1.5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        active
          ? 'border-text-primary bg-bg text-text-primary shadow-sm dark:border-white/[0.62] dark:bg-white/[0.10] dark:text-white dark:shadow-none'
          : 'border-border bg-surface text-text-primary hover:border-border-hover hover:bg-surface-hover dark:border-white/[0.12] dark:bg-white/[0.035] dark:text-white/[0.86] dark:hover:border-white/[0.22] dark:hover:bg-white/[0.07] dark:hover:text-white'
      }`}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className={`mt-0.5 block text-xs ${active ? 'text-text-secondary dark:text-white/[0.72]' : 'text-text-secondary dark:text-white/[0.58]'}`}>
        {meta}
      </span>
    </button>
  );
}

function TierButton({
  active,
  label,
  onClick,
  price,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  price: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[46px] items-center justify-between gap-3 rounded-[10px] border px-3 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        active
          ? 'border-text-primary bg-text-primary text-on-inverse dark:border-white dark:bg-white dark:text-[#030712]'
          : 'border-border bg-surface text-text-primary hover:border-border-hover hover:bg-surface-hover dark:border-white/[0.12] dark:bg-white/[0.035] dark:text-white/[0.86] dark:hover:border-white/[0.22] dark:hover:bg-white/[0.07] dark:hover:text-white'
      }`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-sm font-semibold">{price}</span>
    </button>
  );
}

function StoryboardTargetLogo({ active, target }: { active: boolean; target: StoryboardTargetModel }) {
  const logo = STORYBOARD_TARGET_LOGOS[target];

  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
      <img
        src={logo.src}
        alt=""
        aria-hidden="true"
        className={`h-4 w-4 select-none object-contain ${active ? 'brightness-0 invert dark:invert-0' : 'dark:brightness-0 dark:invert'}`}
        draggable={false}
      />
    </span>
  );
}

function StyleIcon({ style }: { style: StoryboardStyle }) {
  if (style === 'realistic') return <Camera className="h-4 w-4" />;
  if (style === 'ugc') return <Smartphone className="h-4 w-4" />;
  if (style === 'anime') return <Sparkles className="h-4 w-4" />;
  return <Clapperboard className="h-4 w-4" />;
}

function getLengthPresetLabel(copy: StoryboardCopy, presetId: StoryboardLengthPresetId) {
  if (presetId === 'short') return copy.shortPreset;
  if (presetId === 'long') return copy.longPreset;
  return copy.mediumPreset;
}

function getLengthPresetMeta(copy: StoryboardCopy, presetId: StoryboardLengthPresetId) {
  if (presetId === 'short') return copy.shortPresetMeta;
  if (presetId === 'long') return copy.longPresetMeta;
  return copy.mediumPresetMeta;
}

function getTierLabel(copy: StoryboardCopy, tier: StoryboardTier) {
  if (tier === '4k') return copy.fourKTier;
  if (tier === 'ultra') return copy.ultraTier;
  return copy.hdTier;
}
