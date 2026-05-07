'use client';

import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { AngleToolNumericParams } from '@/types/tools-angle';
import type { AngleCopy } from '../_lib/angle-workspace-copy';
import { sanitizeParams } from '../_lib/angle-workspace-helpers';
import type { UploadedImage } from '../_lib/angle-workspace-types';

const AngleOrbitCanvas = dynamic(() => import('@/components/tools/AngleOrbitCanvas'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#f6f8fc]" aria-hidden="true" />,
});

export function AngleOrbitSelector({
  params,
  onParamsChange,
  generateBestAngles,
  onGenerateBestAnglesChange,
  supportsMultiOutput,
  sourceImage,
  copy,
}: {
  params: AngleToolNumericParams;
  onParamsChange: (next: AngleToolNumericParams) => void;
  generateBestAngles: boolean;
  onGenerateBestAnglesChange: (value: boolean) => void;
  supportsMultiOutput: boolean;
  sourceImage?: UploadedImage | null;
  copy: AngleCopy;
}) {
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startRotation: number;
    startTilt: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startRotation: params.rotation,
      startTilt: params.tilt,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    const dx = event.clientX - dragStateRef.current.startX;
    const dy = event.clientY - dragStateRef.current.startY;
    onParamsChange(
      sanitizeParams({
        rotation: dragStateRef.current.startRotation - dx * 0.55,
        tilt: dragStateRef.current.startTilt + dy * 0.18,
        zoom: params.zoom,
      })
    );
  };

  const handlePointerUp = () => {
    dragStateRef.current = null;
    setDragging(false);
  };

  const nudge = (deltaRotation: number, deltaTilt: number) => {
    onParamsChange(
      sanitizeParams({
        rotation: params.rotation + deltaRotation,
        tilt: params.tilt + deltaTilt,
        zoom: params.zoom,
      })
    );
  };

  return (
    <div className="rounded-card border border-border bg-bg p-4">
      <div className="mb-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.orbitTitle}</p>
        <p className="mt-1 text-xs text-text-secondary">{copy.orbitHint}</p>
      </div>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={clsx(
          'relative mx-auto w-full max-w-[360px] touch-none select-none rounded-card border border-border/80 bg-[#f6f8fc] p-3',
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
      >
        <div className="pointer-events-none relative mx-auto h-[320px] w-[320px] overflow-hidden rounded-card">
          <AngleOrbitCanvas params={params} sourceImage={sourceImage} generateBestAngles={generateBestAngles} />

          <button
            type="button"
            className="pointer-events-auto absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-border/80 bg-surface/80 px-2 py-1 text-xs text-text-secondary hover:bg-surface"
            onClick={() => nudge(0, -4)}
          >
            ▲
          </button>
          <button
            type="button"
            className="pointer-events-auto absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-border/80 bg-surface/80 px-2 py-1 text-xs text-text-secondary hover:bg-surface"
            onClick={() => nudge(12, 0)}
          >
            ◀
          </button>
          <button
            type="button"
            className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-border/80 bg-surface/80 px-2 py-1 text-xs text-text-secondary hover:bg-surface"
            onClick={() => nudge(-12, 0)}
          >
            ▶
          </button>
          <button
            type="button"
            className="pointer-events-auto absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border/80 bg-surface/80 px-2 py-1 text-xs text-text-secondary hover:bg-surface"
            onClick={() => nudge(0, 4)}
          >
            ▼
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-text-secondary">
        <span>{copy.rotationShort}: {Math.round(params.rotation)}°</span>
        <span>{copy.tiltShort}: {Math.round(params.tilt)}°</span>
        <span>{copy.zoomShort}: {params.zoom.toFixed(1)}</span>
      </div>

      <label className={clsx('mt-3 flex items-center gap-2 text-sm', !supportsMultiOutput ? 'text-text-muted' : 'text-text-secondary')}>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={generateBestAngles}
          disabled={!supportsMultiOutput}
          onChange={(event) => {
            const nextChecked = event.target.checked;
            onGenerateBestAnglesChange(nextChecked);
            if (nextChecked) {
              onParamsChange(
                sanitizeParams({
                  rotation: 0,
                  tilt: 0,
                  zoom: params.zoom,
                })
              );
            }
          }}
        />
        {copy.bestAngles}
      </label>
    </div>
  );
}
