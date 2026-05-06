import clsx from 'clsx';
import { AudioWaveform, Clock3, Sparkles } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EngineSelect } from '@/components/ui/EngineSelect';
import type { EngineCaps, Mode } from '@/types/engines';
import { DEFAULT_DASHBOARD_COPY, type DashboardCopy } from '../_lib/dashboard-copy';
import { IMAGE_MODE_OPTIONS, MODE_OPTIONS } from '../_lib/dashboard-storage';

export function CreateHero({
  copy,
  videoEngines,
  imageEngines,
  selectedVideoEngineId,
  selectedVideoMode,
  selectedImageEngineId,
  selectedImageMode,
  hasStoredVideoForm,
  hasStoredImageForm,
  canStartVideo,
  canStartImage,
  onVideoModeChange,
  onVideoEngineChange,
  onImageModeChange,
  onImageEngineChange,
  onNewVideo,
  onUseLastVideoSettings,
  onNewImage,
  onUseLastImageSettings,
}: {
  copy: DashboardCopy;
  videoEngines: EngineCaps[];
  imageEngines: EngineCaps[];
  selectedVideoEngineId: string;
  selectedVideoMode: Mode;
  selectedImageEngineId: string;
  selectedImageMode: Mode;
  hasStoredVideoForm: boolean;
  hasStoredImageForm: boolean;
  canStartVideo: boolean;
  canStartImage: boolean;
  onVideoModeChange: (mode: Mode) => void;
  onVideoEngineChange: (engineId: string) => void;
  onImageModeChange: (mode: Mode) => void;
  onImageEngineChange: (engineId: string) => void;
  onNewVideo: () => void;
  onUseLastVideoSettings: () => void;
  onNewImage: () => void;
  onUseLastImageSettings: () => void;
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{copy.create.title}</h1>
          <p className="mt-1 text-sm text-text-secondary">{copy.create.subtitle}</p>
        </div>
        <ButtonLink
          href="/app/audio"
          prefetch={false}
          variant="outline"
          size="sm"
          className="border-[var(--brand-border)] px-4 text-brand hover:bg-[var(--brand-soft)] hover:text-brand"
        >
          <AudioWaveform className="h-4 w-4" aria-hidden />
          {copy.create.generateAudio ?? DEFAULT_DASHBOARD_COPY.create.generateAudio}
        </ButtonLink>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <CreateVideoCard
          copy={copy}
          engines={videoEngines}
          selectedEngineId={selectedVideoEngineId}
          selectedMode={selectedVideoMode}
          hasStoredForm={hasStoredVideoForm}
          reserveLastSettingsSlot={hasStoredVideoForm || hasStoredImageForm}
          canStart={canStartVideo}
          onModeChange={onVideoModeChange}
          onEngineChange={onVideoEngineChange}
          onNew={onNewVideo}
          onUseLast={onUseLastVideoSettings}
        />
        <CreateImageCard
          copy={copy}
          engines={imageEngines}
          selectedEngineId={selectedImageEngineId}
          selectedMode={selectedImageMode}
          hasStoredForm={hasStoredImageForm}
          reserveLastSettingsSlot={hasStoredVideoForm || hasStoredImageForm}
          canStart={canStartImage}
          onModeChange={onImageModeChange}
          onEngineChange={onImageEngineChange}
          onNew={onNewImage}
          onUseLast={onUseLastImageSettings}
        />
      </div>
    </section>
  );
}

function CreateVideoCard({
  copy,
  engines,
  selectedEngineId,
  selectedMode,
  hasStoredForm,
  reserveLastSettingsSlot,
  canStart,
  onModeChange,
  onEngineChange,
  onNew,
  onUseLast,
}: {
  copy: DashboardCopy;
  engines: EngineCaps[];
  selectedEngineId: string;
  selectedMode: Mode;
  hasStoredForm: boolean;
  reserveLastSettingsSlot: boolean;
  canStart: boolean;
  onModeChange: (mode: Mode) => void;
  onEngineChange: (engineId: string) => void;
  onNew: () => void;
  onUseLast: () => void;
}) {
  return (
    <div className="flex h-full min-h-[312px] flex-col rounded-card border border-hairline bg-surface-2/60 p-4">
      <div className="min-h-[58px]">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{copy.create.videoTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary">{copy.create.videoSubtitle}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        <div className="min-w-0">
          <EngineSelect
            engines={engines}
            engineId={selectedEngineId}
            onEngineChange={onEngineChange}
            mode={selectedMode}
            onModeChange={onModeChange}
            modeOptions={MODE_OPTIONS}
            modeLabelOverrides={{
              t2v: copy.modes.t2v,
              i2v: copy.modes.i2v,
              a2v: copy.modes.a2v,
              extend: copy.modes.extend,
              retake: copy.modes.retake,
              r2v: copy.modes.r2v,
            }}
            showModeSelect={false}
            variant="bar"
          />
        </div>
        <div className="mt-auto pt-3">
          <Button
            type="button"
            onClick={onNew}
            disabled={!canStart}
            size="md"
            className={clsx(
              'w-full px-5 py-3 text-base font-semibold',
              !canStart && '!bg-surface-disabled text-text-muted shadow-none hover:!bg-surface-disabled disabled:opacity-100'
            )}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {copy.create.newVideo}
          </Button>
          {reserveLastSettingsSlot ? (
            <div className="mt-2 min-h-[36px]">
              {hasStoredForm ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onUseLast}
                  className="min-h-[36px] border-hairline px-4 text-sm font-semibold text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
                >
                  <Clock3 className="h-4 w-4" aria-hidden />
                  {copy.create.useLastVideo}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CreateImageCard({
  copy,
  engines,
  selectedEngineId,
  selectedMode,
  hasStoredForm,
  reserveLastSettingsSlot,
  canStart,
  onModeChange,
  onEngineChange,
  onNew,
  onUseLast,
}: {
  copy: DashboardCopy;
  engines: EngineCaps[];
  selectedEngineId: string;
  selectedMode: Mode;
  hasStoredForm: boolean;
  reserveLastSettingsSlot: boolean;
  canStart: boolean;
  onModeChange: (mode: Mode) => void;
  onEngineChange: (engineId: string) => void;
  onNew: () => void;
  onUseLast: () => void;
}) {
  return (
    <div className="flex h-full min-h-[312px] flex-col rounded-card border border-hairline bg-surface-2/60 p-4">
      <div className="min-h-[58px]">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{copy.create.imageTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary">{copy.create.imageSubtitle}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        <div className="min-w-0">
          <EngineSelect
            engines={engines}
            engineId={selectedEngineId}
            onEngineChange={onEngineChange}
            mode={selectedMode}
            onModeChange={onModeChange}
            modeOptions={IMAGE_MODE_OPTIONS}
            modeLabelOverrides={{
              t2i: copy.modes.t2i,
              i2i: copy.modes.i2i,
            }}
            showBillingNote={false}
            showModeSelect={false}
            variant="bar"
          />
        </div>
        <div className="mt-auto pt-3">
          <Button
            type="button"
            onClick={onNew}
            disabled={!canStart}
            size="md"
            className={clsx(
              'w-full px-5 py-3 text-base font-semibold',
              !canStart && '!bg-surface-disabled text-text-muted shadow-none hover:!bg-surface-disabled disabled:opacity-100'
            )}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {copy.create.newImage}
          </Button>
          {reserveLastSettingsSlot ? (
            <div className="mt-2 min-h-[36px]">
              {hasStoredForm ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onUseLast}
                  className="min-h-[36px] border-hairline px-4 text-sm font-semibold text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
                >
                  <Clock3 className="h-4 w-4" aria-hidden />
                  {copy.create.useLastImage}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

