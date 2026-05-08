'use client';

import type { ChangeEvent } from 'react';
import type { AngleToolNumericParams } from '@/types/tools-angle';
import type { AngleCopy } from '../_lib/angle-workspace-copy';
import { sanitizeParams } from '../_lib/angle-workspace-helpers';

interface AngleCameraControlsProps {
  copy: AngleCopy;
  onParamsChange: (next: AngleToolNumericParams) => void;
  params: AngleToolNumericParams;
}

export function AngleCameraControls({ copy, onParamsChange, params }: AngleCameraControlsProps) {
  const negativeTiltActive = params.tilt < 0;
  const tiltFillPercent = ((params.tilt + 30) / 60) * 100;
  const tiltTrackStyle = {
    background: `linear-gradient(to right, ${
      negativeTiltActive ? '#d97706' : '#0ea5e9'
    } 0%, ${negativeTiltActive ? '#d97706' : '#0ea5e9'} ${tiltFillPercent}%, #d9e0ea ${tiltFillPercent}%, #d9e0ea 100%)`,
  };

  const handleParamChange = (key: keyof AngleToolNumericParams) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    onParamsChange(sanitizeParams({ ...params, [key]: value }));
  };

  return (
    <div className="space-y-3 rounded-card border border-border bg-bg p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.cameraControls}</p>
      </div>

      <label className="block">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium text-text-primary">{copy.rotationRange}</span>
          <span className="text-text-muted">
            {params.rotation.toFixed(0)} {copy.degreeUnit}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={params.rotation}
          onChange={handleParamChange('rotation')}
          className="range-input h-1 w-full appearance-none overflow-hidden rounded-full bg-hairline"
        />
      </label>

      <label className="block">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium text-text-primary">{copy.tiltRange}</span>
          <span className="text-text-muted">
            {params.tilt.toFixed(0)} {copy.degreeUnit}
          </span>
        </div>
        <input
          type="range"
          min={-30}
          max={30}
          step={1}
          value={params.tilt}
          onChange={handleParamChange('tilt')}
          className="range-input h-1 w-full appearance-none overflow-hidden rounded-full"
          style={tiltTrackStyle}
        />
      </label>

      <label className="block">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium text-text-primary">{copy.zoomRange}</span>
          <span className="text-text-muted">{params.zoom.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={0.1}
          value={params.zoom}
          onChange={handleParamChange('zoom')}
          className="range-input h-1 w-full appearance-none overflow-hidden rounded-full bg-hairline"
        />
      </label>
    </div>
  );
}
