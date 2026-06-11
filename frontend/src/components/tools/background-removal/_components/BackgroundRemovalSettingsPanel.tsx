import { Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  BACKGROUND_REMOVAL_OUTPUT_CODECS,
  BACKGROUND_REMOVAL_STUDIO_COLORS,
} from '@/lib/tools-background-removal';
import type {
  BackgroundRemovalOutputCodec,
  BackgroundRemovalStudioBackgroundColor,
} from '@/types/tools-background-removal';
import type { BackgroundRemovalWorkspaceCopy } from '../_lib/background-removal-workspace-copy';

export function BackgroundRemovalSettingsPanel(props: {
  backgroundColor: BackgroundRemovalStudioBackgroundColor;
  canRun: boolean;
  copy: BackgroundRemovalWorkspaceCopy;
  error: string | null;
  message: string | null;
  onBackgroundColorChange: (value: BackgroundRemovalStudioBackgroundColor) => void;
  onOutputCodecChange: (value: BackgroundRemovalOutputCodec) => void;
  onPreserveAudioChange: (value: boolean) => void;
  onRun: () => void;
  outputCodec: BackgroundRemovalOutputCodec;
  preserveAudio: boolean;
  priceHint: string;
  priceLabel: string;
  running: boolean;
}) {
  return (
    <Card className="p-4">
      <h2 className="text-base font-semibold text-text-primary">{props.copy.settingsTitle}</h2>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-text-primary">
          {props.copy.backgroundColor}
          <select
            className="rounded-input border border-border bg-bg px-3 py-2 text-sm"
            onChange={(event) => props.onBackgroundColorChange(event.target.value as BackgroundRemovalStudioBackgroundColor)}
            value={props.backgroundColor}
          >
            {BACKGROUND_REMOVAL_STUDIO_COLORS.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-text-primary">
          {props.copy.outputCodec}
          <select
            className="rounded-input border border-border bg-bg px-3 py-2 text-sm"
            onChange={(event) => props.onOutputCodecChange(event.target.value as BackgroundRemovalOutputCodec)}
            value={props.outputCodec}
          >
            {BACKGROUND_REMOVAL_OUTPUT_CODECS.map((codec) => (
              <option key={codec} value={codec}>
                {codec}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-3 rounded-input border border-border bg-bg px-3 py-2 text-sm font-medium text-text-primary">
          <span className="inline-flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-text-muted" />
            {props.copy.preserveAudio}
          </span>
          <input
            checked={props.preserveAudio}
            onChange={(event) => props.onPreserveAudioChange(event.target.checked)}
            type="checkbox"
          />
        </label>
      </div>
      <div className="mt-4 rounded-input border border-border bg-bg p-3">
        <p className="text-lg font-semibold text-text-primary">{props.priceLabel}</p>
        <p className="text-xs text-text-secondary">{props.priceHint}</p>
      </div>
      {props.error ? <p className="mt-3 text-sm font-semibold text-danger">{props.error}</p> : null}
      {props.message ? <p className="mt-3 text-sm text-text-secondary">{props.message}</p> : null}
      <Button className="mt-4 w-full" disabled={!props.canRun} onClick={props.onRun}>
        {props.running ? props.copy.running : props.copy.run}
      </Button>
    </Card>
  );
}
