import { Camera, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { BackgroundRemovalRealtimeBackgroundType } from '@/types/tools-background-removal';
import type { BackgroundRemovalWorkspaceCopy } from '../_lib/background-removal-workspace-copy';

export function BackgroundRemovalRealtimePanel(props: {
  backgroundColor: string;
  backgroundImageUrl: string;
  backgroundType: BackgroundRemovalRealtimeBackgroundType;
  blurStrength: number;
  copy: BackgroundRemovalWorkspaceCopy;
  error: string | null;
  onBackgroundColorChange: (value: string) => void;
  onBackgroundImageUrlChange: (value: string) => void;
  onBackgroundTypeChange: (value: BackgroundRemovalRealtimeBackgroundType) => void;
  onBlurStrengthChange: (value: number) => void;
  onStart: () => void;
  onStop: () => void;
  remainingSeconds: number;
  status: 'idle' | 'connecting' | 'live' | 'ended' | 'error';
  stream: MediaStream | null;
}) {
  const statusLabel =
    props.status === 'connecting'
      ? props.copy.liveConnecting
      : props.status === 'live'
        ? `${props.copy.liveReady} · ${props.remainingSeconds}s`
        : props.status === 'ended'
          ? props.copy.liveEnded
          : props.copy.liveBody;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{props.copy.liveTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary">{statusLabel}</p>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-input bg-brand/10 text-brand">
          <Camera className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            ['color', props.copy.liveModeColor],
            ['blur', props.copy.liveModeBlur],
            ['image', props.copy.liveModeImage],
          ].map(([value, label]) => (
            <Button
              key={value}
              onClick={() => props.onBackgroundTypeChange(value as BackgroundRemovalRealtimeBackgroundType)}
              size="sm"
              variant={props.backgroundType === value ? 'primary' : 'outline'}
            >
              {label}
            </Button>
          ))}
        </div>
        {props.backgroundType === 'color' ? (
          <input
            className="h-10 w-full rounded-input border border-border bg-bg px-2"
            onChange={(event) => props.onBackgroundColorChange(event.target.value)}
            type="color"
            value={props.backgroundColor}
          />
        ) : null}
        {props.backgroundType === 'blur' ? (
          <input
            max={100}
            min={0}
            onChange={(event) => props.onBlurStrengthChange(Number(event.target.value))}
            type="range"
            value={props.blurStrength}
          />
        ) : null}
        {props.backgroundType === 'image' ? (
          <input
            className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm"
            onChange={(event) => props.onBackgroundImageUrlChange(event.target.value)}
            placeholder={props.copy.backgroundImageUrl}
            type="url"
            value={props.backgroundImageUrl}
          />
        ) : null}
      </div>
      <div className="mt-4 aspect-video overflow-hidden rounded-card border border-border bg-black">
        {props.stream ? <video autoPlay className="h-full w-full object-cover" muted playsInline ref={(node) => {
          if (node && node.srcObject !== props.stream) node.srcObject = props.stream;
        }} /> : null}
      </div>
      {props.error ? <p className="mt-3 text-xs font-semibold text-danger">{props.error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button disabled={props.status === 'connecting' || props.status === 'live'} onClick={props.onStart} size="sm">
          <Camera className="h-4 w-4" />
          {props.copy.liveStart}
        </Button>
        <Button disabled={props.status !== 'live'} onClick={props.onStop} size="sm" variant="outline">
          <Square className="h-4 w-4" />
          {props.copy.liveStop}
        </Button>
      </div>
    </Card>
  );
}
