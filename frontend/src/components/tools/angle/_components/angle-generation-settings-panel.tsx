'use client';

import {
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type Ref,
} from 'react';
import { Loader2, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { AngleToolEngineDefinition, AngleToolEngineId, AngleToolNumericParams } from '@/types/tools-angle';
import { AngleCameraControls } from './angle-camera-controls';
import { AngleOrbitSelector } from './angle-orbit-selector';
import { AngleSourceImagePanel } from './angle-source-image-panel';
import type { AngleCopy } from '../_lib/angle-workspace-copy';
import { formatUsdCompact } from '../_lib/angle-workspace-helpers';
import type { UploadedImage } from '../_lib/angle-workspace-types';

interface AngleGenerationSettingsPanelProps {
  copy: AngleCopy;
  engineId: AngleToolEngineId;
  engines: readonly AngleToolEngineDefinition[];
  error: string | null;
  estimatedCostUsd: number;
  fileInputRef: Ref<HTMLInputElement>;
  generateBestAngles: boolean;
  generating: boolean;
  onAuthRequired: () => void;
  onEngineIdChange: (engineId: AngleToolEngineId) => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onGenerate: () => void;
  onGenerateBestAnglesChange: (enabled: boolean) => void;
  onLibraryOpen: () => void;
  onParamsChange: (params: AngleToolNumericParams) => void;
  onRemoveSource: () => void;
  onSourceDragActiveChange: (active: boolean) => void;
  onSourceDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  onSourcePaste: (event: ReactClipboardEvent<HTMLDivElement>) => void;
  onUploadRequest: () => void;
  params: AngleToolNumericParams;
  selectedEngine?: AngleToolEngineDefinition;
  sourceDragActive: boolean;
  sourceImage: UploadedImage | null;
  uploading: boolean;
  userPresent: boolean;
}

export function AngleGenerationSettingsPanel({
  copy,
  engineId,
  engines,
  error,
  estimatedCostUsd,
  fileInputRef,
  generateBestAngles,
  generating,
  onAuthRequired,
  onEngineIdChange,
  onFileSelect,
  onGenerate,
  onGenerateBestAnglesChange,
  onLibraryOpen,
  onParamsChange,
  onRemoveSource,
  onSourceDragActiveChange,
  onSourceDrop,
  onSourcePaste,
  onUploadRequest,
  params,
  selectedEngine,
  sourceDragActive,
  sourceImage,
  uploading,
  userPresent,
}: AngleGenerationSettingsPanelProps) {
  return (
    <Card className="border border-border bg-surface p-5">
      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.engine}</p>
              <label className="mt-2 block">
                <span className="sr-only">{copy.engineSelect}</span>
                <select
                  value={engineId}
                  onChange={(event) => onEngineIdChange(event.target.value as AngleToolEngineId)}
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                >
                  {engines.map((engine) => (
                    <option key={engine.id} value={engine.id}>
                      {copy.engines[engine.id].label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-xs text-text-muted">{selectedEngine ? copy.engines[selectedEngine.id].description : null}</p>
              {engineId === 'flux-multiple-angles' ? (
                <p className="mt-1 text-xs text-text-muted">{copy.engineHelpFlux}</p>
              ) : null}
              {engineId === 'qwen-multiple-angles' && params.tilt < 0 ? (
                <p className="mt-1 text-xs text-warning">{copy.engineHelpQwen}</p>
              ) : null}
            </div>

            <AngleSourceImagePanel
              copy={copy}
              fileInputRef={fileInputRef}
              onAuthRequired={onAuthRequired}
              onFileSelect={onFileSelect}
              onLibraryOpen={onLibraryOpen}
              onRemoveSource={onRemoveSource}
              onSourceDragActiveChange={onSourceDragActiveChange}
              onSourceDrop={onSourceDrop}
              onSourcePaste={onSourcePaste}
              onUploadRequest={onUploadRequest}
              sourceDragActive={sourceDragActive}
              sourceImage={sourceImage}
              uploading={uploading}
              userPresent={userPresent}
            />
          </div>

          <AngleOrbitSelector
            params={params}
            onParamsChange={onParamsChange}
            generateBestAngles={generateBestAngles}
            onGenerateBestAnglesChange={onGenerateBestAnglesChange}
            supportsMultiOutput={Boolean(selectedEngine?.supportsMultiOutput)}
            sourceImage={sourceImage}
            copy={copy}
          />
        </div>

        <AngleCameraControls copy={copy} onParamsChange={onParamsChange} params={params} />

        <div className="rounded-card border border-border bg-bg p-4">
          <p className="text-xs uppercase tracking-micro text-text-muted">{copy.estimatedCost}</p>
          <p className="mt-2 text-2xl font-semibold leading-none text-text-primary">
            {formatUsdCompact(estimatedCostUsd)}
          </p>
        </div>

        <Button
          type="button"
          variant={userPresent ? 'primary' : 'outline'}
          className="w-full gap-2"
          onClick={userPresent ? onGenerate : onAuthRequired}
          disabled={generating || uploading || !sourceImage?.url}
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
          {generating ? copy.generating : userPresent ? copy.generate : copy.generateLocked}
        </Button>

        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
