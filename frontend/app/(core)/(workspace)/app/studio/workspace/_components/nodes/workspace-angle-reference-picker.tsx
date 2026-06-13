'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { DEFAULT_ANGLE_COPY } from '@/components/tools/angle/_lib/angle-workspace-copy';
import { sanitizeParams } from '@/components/tools/angle/_lib/angle-workspace-helpers';
import type { UploadedImage } from '@/components/tools/angle/_lib/angle-workspace-types';
import type { AngleToolNumericParams } from '@/types/tools-angle';
import styles from './angle-reference-picker.module.css';
import type {
  WorkspaceGraphNode,
  WorkspaceReferencePreview,
  WorkspaceShotSettings,
} from '../../_lib/workspace-types';

const AngleOrbitCanvas = dynamic(() => import('@/components/tools/AngleOrbitCanvas'), {
  ssr: false,
  loading: () => <div className={styles.anglePickerCanvasFallback} aria-hidden="true" />,
});

type WorkspaceAngleSettings = NonNullable<NonNullable<WorkspaceShotSettings['toolSettings']>['angle']>;

type StudioAngleOrbitCopy = {
  orbitTitle: string;
  orbitHint: string;
  rotationShort: string;
  tiltShort: string;
  zoomShort: string;
  bestAngles: string;
};

const DEFAULT_ANGLE_SETTINGS: WorkspaceAngleSettings = {
  rotation: 35,
  tilt: 0,
  zoom: 1,
  safeMode: true,
  generateBestAngles: false,
};

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function angleSettingsForShot(shot: WorkspaceShotSettings): WorkspaceAngleSettings {
  const angle = shot.toolSettings?.angle;
  const params = sanitizeParams({
    rotation: toNumber(angle?.rotation, DEFAULT_ANGLE_SETTINGS.rotation),
    tilt: toNumber(angle?.tilt, DEFAULT_ANGLE_SETTINGS.tilt),
    zoom: toNumber(angle?.zoom, DEFAULT_ANGLE_SETTINGS.zoom),
  });
  return {
    ...DEFAULT_ANGLE_SETTINGS,
    ...angle,
    ...params,
    safeMode: angle?.safeMode ?? DEFAULT_ANGLE_SETTINGS.safeMode,
    generateBestAngles: angle?.generateBestAngles ?? DEFAULT_ANGLE_SETTINGS.generateBestAngles,
  };
}

function sourceImageForPreview(preview?: WorkspaceReferencePreview | null): UploadedImage | null {
  if (!preview?.url) return null;
  return {
    id: preview.id ?? null,
    url: preview.url,
    previewUrl: preview.previewUrl ?? preview.url,
    width: preview.width ?? null,
    height: preview.height ?? null,
    name: preview.name ?? DEFAULT_ANGLE_COPY.referenceName,
    source: 'library',
  };
}

function studioAngleCopy(
  copy: NonNullable<WorkspaceGraphNode['data']['studioCanvasCopy']>['nodes'] | null
): StudioAngleOrbitCopy {
  return {
    ...DEFAULT_ANGLE_COPY,
    orbitTitle: copy?.anglePickerTitle ?? DEFAULT_ANGLE_COPY.orbitTitle,
    orbitHint: copy?.anglePickerHint ?? DEFAULT_ANGLE_COPY.orbitHint,
    rotationShort: copy?.anglePickerRotation ?? DEFAULT_ANGLE_COPY.rotationShort,
    tiltShort: copy?.anglePickerTilt ?? DEFAULT_ANGLE_COPY.tiltShort,
    zoomShort: copy?.anglePickerZoom ?? DEFAULT_ANGLE_COPY.zoomShort,
    bestAngles: copy?.anglePickerBestAngles ?? DEFAULT_ANGLE_COPY.bestAngles,
  };
}

type AngleReferencePickerProps = {
  copy: NonNullable<WorkspaceGraphNode['data']['studioCanvasCopy']>['nodes'] | null;
  disabled: boolean;
  onPatchAngle: (angle: WorkspaceAngleSettings) => void;
  referencePreview?: WorkspaceReferencePreview | null;
  shot: WorkspaceShotSettings;
};

export function AngleReferencePicker({
  copy,
  disabled,
  onPatchAngle,
  referencePreview,
  shot,
}: AngleReferencePickerProps) {
  const angle = angleSettingsForShot(shot);
  const angleCopy = useMemo(() => studioAngleCopy(copy), [copy]);
  const sourceImage = useMemo(() => sourceImageForPreview(referencePreview), [referencePreview]);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startRotation: number;
    startTilt: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const patchParams = (next: AngleToolNumericParams) => {
    if (disabled) return;
    const params = sanitizeParams(next);
    onPatchAngle({
      ...angle,
      rotation: params.rotation,
      tilt: params.tilt,
      zoom: params.zoom,
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startRotation: angle.rotation,
      startTilt: angle.tilt,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    const dx = event.clientX - dragStateRef.current.startX;
    const dy = event.clientY - dragStateRef.current.startY;
    patchParams({
      rotation: dragStateRef.current.startRotation - dx * 0.55,
      tilt: dragStateRef.current.startTilt + dy * 0.18,
      zoom: angle.zoom,
    });
  };

  const handlePointerUp = () => {
    dragStateRef.current = null;
    setDragging(false);
  };

  const nudge = (deltaRotation: number, deltaTilt: number) => {
    patchParams({
      rotation: angle.rotation + deltaRotation,
      tilt: angle.tilt + deltaTilt,
      zoom: angle.zoom,
    });
  };

  const toggleBestAngles = (checked: boolean) => {
    if (disabled) return;
    const params = sanitizeParams({
      rotation: checked ? 0 : angle.rotation,
      tilt: checked ? 0 : angle.tilt,
      zoom: angle.zoom,
    });
    onPatchAngle({
      ...angle,
      ...params,
      generateBestAngles: checked,
    });
  };

  return (
    <div
      className={`${styles.anglePicker} ${disabled ? styles.anglePickerDisabled : ''}`}
      data-angle-picker
      aria-disabled={disabled}
    >
      <div className={styles.anglePickerHeader}>
        <strong>{angleCopy.orbitTitle}</strong>
        <span>{angleCopy.orbitHint}</span>
      </div>
      <div
        className={`${styles.anglePickerStage} ${dragging ? styles.anglePickerStageDragging : ''} nodrag nowheel`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <AngleOrbitCanvas params={angle} sourceImage={sourceImage} generateBestAngles={angle.generateBestAngles} />
        <button type="button" className={styles.anglePickerTopButton} disabled={disabled} onClick={() => nudge(0, -4)} aria-label={angleCopy.tiltShort}>
          ▲
        </button>
        <button type="button" className={styles.anglePickerLeftButton} disabled={disabled} onClick={() => nudge(12, 0)} aria-label={angleCopy.rotationShort}>
          ◀
        </button>
        <button type="button" className={styles.anglePickerRightButton} disabled={disabled} onClick={() => nudge(-12, 0)} aria-label={angleCopy.rotationShort}>
          ▶
        </button>
        <button type="button" className={styles.anglePickerBottomButton} disabled={disabled} onClick={() => nudge(0, 4)} aria-label={angleCopy.tiltShort}>
          ▼
        </button>
        {disabled ? (
          <span className={styles.anglePickerOverlay}>{copy?.anglePickerConnectReference ?? 'Connect reference'}</span>
        ) : null}
      </div>
      <div className={styles.anglePickerFooter}>
        <span>{Math.round(angle.rotation)}°</span>
        <span>{Math.round(angle.tilt)}°</span>
        <label className="nodrag nowheel">
          <input
            type="checkbox"
            checked={angle.generateBestAngles}
            disabled={disabled}
            onChange={(event) => toggleBestAngles(event.currentTarget.checked)}
          />
          {angleCopy.bestAngles}
        </label>
      </div>
    </div>
  );
}
