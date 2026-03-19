'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import Link from 'next/link';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import useSWR from 'swr';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { ArrowLeft, Download, Images, Loader2, Plus, Upload, WandSparkles, X } from 'lucide-react';
import * as THREE from 'three';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { listAngleToolEngines } from '@/config/tools-angle-engines';
import { runAngleTool, saveImageToLibrary, useInfiniteJobs } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { resolveAngleEngineForParams } from '@/lib/tools-angle';
import { buildBestAngleVariantParams } from '@/lib/tools-angle';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FEATURES } from '@/content/feature-flags';
import type { AngleToolEngineId, AngleToolNumericParams, AngleToolResponse } from '@/types/tools-angle';

type UploadedImage = {
  id?: string | null;
  url: string;
  previewUrl?: string | null;
  width?: number | null;
  height?: number | null;
  name?: string | null;
  source?: 'upload' | 'library' | 'paste';
};

type LibraryAsset = {
  id: string;
  url: string;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  source?: string | null;
  createdAt?: string;
};

type LibraryAssetsResponse = {
  ok: boolean;
  assets: LibraryAsset[];
};

type BillingProductResponse = {
  ok: boolean;
  product?: {
    productKey: string;
    currency: string;
    unitPriceCents: number;
  };
  error?: string;
};

type AnglePreviewImage = {
  url: string;
  thumbUrl?: string | null;
};

type RecentAngleJobEntry = {
  jobId: string;
  createdAt: string;
  engineLabel: string;
  outputs: AnglePreviewImage[];
};

const ENGINES = listAngleToolEngines();
const DEFAULT_ENGINE_ID = ENGINES[0]?.id ?? 'flux-multiple-angles';
const ANGLE_TOOL_STORAGE_KEY = 'maxvideoai.tools.angle.v1';
const ANGLE_MULTI_OUTPUT_COUNT = 4;

type PersistedAngleToolState = {
  version: 1;
  engineId: AngleToolEngineId;
  params: AngleToolNumericParams;
  safeMode: boolean;
  generateBestAngles: boolean;
  sourceImage: UploadedImage | null;
  result: AngleToolResponse | null;
  selectedOutputIndex: number;
};

function getAngleBillingProductKey(engineId: AngleToolEngineId, generateBestAngles: boolean): string {
  const family = engineId === 'qwen-multiple-angles' ? 'qwen' : 'flux';
  return `angle-${family}-${generateBestAngles ? 'multi' : 'single'}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeRotation(value: number): number {
  return ((value % 360) + 360) % 360;
}

function snap(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(step < 1 ? 1 : 0));
}

function sanitizeParams(params: AngleToolNumericParams): AngleToolNumericParams {
  return {
    rotation: normalizeRotation(snap(params.rotation, 1)),
    tilt: clamp(snap(params.tilt, 1), -30, 30),
    zoom: clamp(snap(params.zoom, 0.1), 0, 10),
  };
}

function emitClientMetric(event: string, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('mvai:analytics', { detail: { event, payload } }));
  } catch {
    // Ignore analytics transport failures.
  }
}

function formatUsd(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a';
  return `$${value.toFixed(4)}`;
}

function formatUsdCompact(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a';
  return `$${value.toFixed(2)}`;
}

function cleanupSourcePreview(image: UploadedImage | null) {
  if (!image?.previewUrl?.startsWith('blob:')) return;
  try {
    URL.revokeObjectURL(image.previewUrl);
  } catch {
    // Ignore preview cleanup failures.
  }
}

function collectAnglePreviewImages(
  renderIds?: string[] | null,
  renderThumbUrls?: string[] | null,
  fallbackUrl?: string | null
): AnglePreviewImage[] {
  const full = Array.isArray(renderIds) ? renderIds.filter((value): value is string => typeof value === 'string' && value.length > 0) : [];
  const thumbs = Array.isArray(renderThumbUrls)
    ? renderThumbUrls.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  const count = Math.max(full.length, thumbs.length);

  if (count > 0) {
    const outputs: AnglePreviewImage[] = [];
    for (let index = 0; index < count; index += 1) {
      const url = full[index] ?? thumbs[index];
      if (!url) continue;
      outputs.push({
        url,
        thumbUrl: thumbs[index] ?? full[index] ?? null,
      });
    }
    if (outputs.length) return outputs;
  }

  if (fallbackUrl) {
    return [{ url: fallbackUrl, thumbUrl: fallbackUrl }];
  }

  return [];
}

function AngleOutputMosaic({
  outputs,
  selectedIndex,
  onSelect,
  onDownload,
  onAddToLibrary,
  libraryDisabled = false,
  compact = false,
  singleRow = false,
}: {
  outputs: AnglePreviewImage[];
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  onDownload?: (url: string) => void;
  onAddToLibrary?: (url: string) => void;
  libraryDisabled?: boolean;
  compact?: boolean;
  singleRow?: boolean;
}) {
  if (!outputs.length) return null;

  if (outputs.length === 1) {
    const output = outputs[0];
    return (
      <div className={clsx('overflow-hidden rounded-card border border-border bg-bg', compact ? 'h-full' : '')}>
        <div className="relative">
          <img
            src={output.thumbUrl ?? output.url}
            alt=""
            className={clsx('w-full', compact ? 'h-full object-cover' : 'h-[360px] object-contain')}
          />
          {!compact && (onDownload || onAddToLibrary) ? (
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              {onAddToLibrary ? (
                <button
                  type="button"
                  title={libraryDisabled ? 'Already in Library' : 'Add to Library'}
                  onClick={() => onAddToLibrary(output.url)}
                  disabled={libraryDisabled}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition hover:bg-black/70 disabled:cursor-default disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              ) : null}
              {onDownload ? (
                <button
                  type="button"
                  title="Download"
                  onClick={() => onDownload(output.url)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition hover:bg-black/70"
                >
                  <Download className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(singleRow ? 'grid grid-cols-4 gap-2' : 'grid grid-cols-2 gap-3')}>
      {outputs.slice(0, 4).map((output, index) => {
        const selected = index === selectedIndex;
        const content = (
          <>
            <div className={clsx('relative overflow-hidden bg-bg', singleRow ? 'aspect-[4/5]' : 'aspect-square')}>
              <img src={output.thumbUrl ?? output.url} alt="" className="h-full w-full object-cover" />
              {!compact && selected && (onDownload || onAddToLibrary) ? (
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  {onAddToLibrary ? (
                    <button
                      type="button"
                      title={libraryDisabled ? 'Already in Library' : 'Add to Library'}
                      onClick={(event) => {
                        event.stopPropagation();
                        onAddToLibrary(output.url);
                      }}
                      disabled={libraryDisabled}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition hover:bg-black/70 disabled:cursor-default disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {onDownload ? (
                    <button
                      type="button"
                      title="Download"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDownload(output.url);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition hover:bg-black/70"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {!compact && !singleRow ? (
              <div className="px-2 py-1 text-left text-[11px] text-text-secondary">
                Angle {index + 1}
                {selected ? ' · selected' : ''}
              </div>
            ) : null}
          </>
        );

        if (!onSelect) {
          return (
            <div key={`${output.url}-${index}`} className="overflow-hidden rounded-card border border-border bg-bg">
              {content}
            </div>
          );
        }

        return (
          <button
            key={`${output.url}-${index}`}
            type="button"
            onClick={() => onSelect(index)}
            className={clsx(
              'overflow-hidden rounded-card border bg-bg text-left transition',
              selected ? 'border-brand ring-1 ring-brand/40' : 'border-border hover:border-brand/40'
            )}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

function parsePersistedAngleToolState(value: string): PersistedAngleToolState | null {
  try {
    const raw = JSON.parse(value) as Partial<PersistedAngleToolState> | null;
    if (!raw || typeof raw !== 'object' || raw.version !== 1) return null;
    const engineId =
      raw.engineId === 'flux-multiple-angles' || raw.engineId === 'qwen-multiple-angles'
        ? raw.engineId
        : null;
    if (!engineId) return null;
    const params =
      raw.params && typeof raw.params === 'object'
        ? sanitizeParams({
            rotation: Number((raw.params as AngleToolNumericParams).rotation ?? 0),
            tilt: Number((raw.params as AngleToolNumericParams).tilt ?? 0),
            zoom: Number((raw.params as AngleToolNumericParams).zoom ?? 0),
          })
        : { rotation: 8, tilt: 2, zoom: 1.2 };
    const sourceImage =
      raw.sourceImage &&
      typeof raw.sourceImage === 'object' &&
      typeof raw.sourceImage.url === 'string' &&
      raw.sourceImage.url.trim().length
        ? {
            id: typeof raw.sourceImage.id === 'string' ? raw.sourceImage.id : null,
            url: raw.sourceImage.url,
            previewUrl:
              typeof raw.sourceImage.previewUrl === 'string' && raw.sourceImage.previewUrl.trim().length
                ? raw.sourceImage.previewUrl
                : raw.sourceImage.url,
            width: typeof raw.sourceImage.width === 'number' ? raw.sourceImage.width : null,
            height: typeof raw.sourceImage.height === 'number' ? raw.sourceImage.height : null,
            name: typeof raw.sourceImage.name === 'string' ? raw.sourceImage.name : null,
            source:
              raw.sourceImage.source === 'upload' || raw.sourceImage.source === 'library' || raw.sourceImage.source === 'paste'
                ? raw.sourceImage.source
                : undefined,
          }
        : null;
    const result =
      raw.result &&
      typeof raw.result === 'object' &&
      Array.isArray(raw.result.outputs)
        ? (raw.result as AngleToolResponse)
        : null;
    const selectedOutputIndex =
      typeof raw.selectedOutputIndex === 'number' && Number.isFinite(raw.selectedOutputIndex)
        ? Math.max(0, Math.floor(raw.selectedOutputIndex))
        : 0;

    return {
      version: 1,
      engineId,
      params,
      safeMode: raw.safeMode !== false,
      generateBestAngles: raw.generateBestAngles === true,
      sourceImage,
      result,
      selectedOutputIndex,
    };
  } catch {
    return null;
  }
}

async function uploadImage(file: File): Promise<UploadedImage> {
  const formData = new FormData();
  formData.set('file', file);

  const response = await authFetch('/api/uploads/image', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        error?: string;
        maxMB?: number;
        asset?: {
          url: string;
          width?: number | null;
          height?: number | null;
          name?: string | null;
        };
      }
    | null;

  if (!response.ok || !payload?.ok || !payload.asset?.url) {
    if (payload?.error === 'FILE_TOO_LARGE') {
      throw new Error(`Image exceeds ${payload.maxMB ?? 25} MB.`);
    }
    throw new Error(payload?.error ?? `Upload failed (${response.status})`);
  }

  return {
    url: payload.asset.url,
    width: payload.asset.width,
    height: payload.asset.height,
    name: payload.asset.name,
  };
}

function AngleOrbitSelector({
  params,
  onParamsChange,
  generateBestAngles,
  onGenerateBestAnglesChange,
  supportsMultiOutput,
  sourceImage,
}: {
  params: AngleToolNumericParams;
  onParamsChange: (next: AngleToolNumericParams) => void;
  generateBestAngles: boolean;
  onGenerateBestAnglesChange: (value: boolean) => void;
  supportsMultiOutput: boolean;
  sourceImage?: UploadedImage | null;
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
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">3D Angle Picker</p>
        <p className="mt-1 text-xs text-text-secondary">Hold and drag to change camera angle</p>
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
          <Canvas
            dpr={[1, 2]}
            camera={{ position: [0, 1.35, 6.4], fov: 32, near: 0.1, far: 50 }}
            gl={{ antialias: true, alpha: false }}
          >
            <color attach="background" args={['#f6f8fc']} />
            <fog attach="fog" args={['#f6f8fc', 10, 22]} />
            <ambientLight intensity={1.3} />
            <directionalLight position={[5, 6, 4]} intensity={2.1} color="#ffffff" />
            <directionalLight position={[-3, 1.5, -4]} intensity={0.65} color="#dbe6f7" />
            <pointLight position={[0, -1.2, 0]} intensity={0.16} color="#cddaf0" />
            <AngleCameraRig params={params} />
            <AngleReferenceScene sourceImage={sourceImage} generateBestAngles={generateBestAngles} params={params} />
          </Canvas>

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
        <span>Rotation: {Math.round(params.rotation)}°</span>
        <span>Tilt: {Math.round(params.tilt)}°</span>
        <span>Zoom: {params.zoom.toFixed(1)}</span>
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
        Generate from 4 best angles
      </label>
    </div>
  );
}

function AngleCameraRig({ params }: { params: AngleToolNumericParams }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 1.2, 0));
  const desiredPosition = useRef(new THREE.Vector3(0, 1.35, 7.9));

  useFrame(() => {
    const yaw = (params.rotation * Math.PI) / 180;
    const pitch = (params.tilt / 30) * (Math.PI / 5);
    const distance = 8.3 - params.zoom * 0.46;
    const planarDistance = Math.cos(pitch) * distance;

    desiredPosition.current.set(
      Math.sin(yaw) * planarDistance,
      1.15 + Math.sin(pitch) * distance * 1.1,
      Math.cos(yaw) * planarDistance
    );

    camera.position.lerp(desiredPosition.current, 0.16);
    camera.lookAt(target.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      const nextFov = clamp(32 - params.zoom * 0.72, 20, 32);
      if (Math.abs(camera.fov - nextFov) > 0.01) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
    }
  });

  return null;
}

function AngleReferenceScene({
  sourceImage,
  generateBestAngles,
  params,
}: {
  sourceImage?: UploadedImage | null;
  generateBestAngles: boolean;
  params: AngleToolNumericParams;
}) {
  return (
    <>
      <group position={[0, -0.95, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[6.6, 64]} />
          <meshStandardMaterial color="#eef2f9" roughness={0.98} metalness={0.02} />
        </mesh>
      </group>

      {generateBestAngles ? <AngleBestAnglesGuides params={params} /> : null}
      {sourceImage?.url ? <AngleImageCard sourceImage={sourceImage} /> : null}
    </>
  );
}

function AngleBestAnglesGuides({ params }: { params: AngleToolNumericParams }) {
  const guideColor = '#97a8c2';
  const offsets = buildBestAngleVariantParams(params);
  const target = useMemo(() => new THREE.Vector3(0, 1.2, 0), []);

  return (
    <group>
      {offsets.map((offset, index) => (
        <AngleGuideLine key={`best-angle-guide-${index}`} target={target} rotation={offset.rotation} tilt={offset.tilt} color={guideColor} />
      ))}
    </group>
  );
}

function AngleGuideLine({
  target,
  rotation,
  tilt,
  color,
}: {
  target: THREE.Vector3;
  rotation: number;
  tilt: number;
  color: string;
}) {
  const lineObject = useMemo(() => {
    const yaw = (rotation * Math.PI) / 180;
    const pitch = (tilt / 30) * (Math.PI / 5);
    const distance = 4.8;
    const planarDistance = Math.cos(pitch) * distance;
    const position = new THREE.Vector3(
      Math.sin(yaw) * planarDistance,
      1.2 + Math.sin(pitch) * distance * 1.05,
      Math.cos(yaw) * planarDistance
    );
    const geometry = new THREE.BufferGeometry().setFromPoints([target.clone(), position]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
    return new THREE.Line(geometry, material);
  }, [color, rotation, target, tilt]);

  useEffect(() => {
    return () => {
      lineObject.geometry.dispose();
      const material = lineObject.material;
      if (material instanceof THREE.Material) {
        material.dispose();
      }
    };
  }, [lineObject]);

  return <primitive object={lineObject} />;
}

function useSourceTexture(urls: Array<string | null | undefined>) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const candidates = urls
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry, index, array) => entry.length > 0 && array.indexOf(entry) === index);
    if (!candidates.length) {
      setTexture(null);
      return;
    }

    let active = true;
    let currentTexture: THREE.Texture | null = null;

    const tryLoad = (index: number) => {
      if (!active || index >= candidates.length) {
        if (active) {
          setTexture(null);
        }
        return;
      }
      const loader = new THREE.TextureLoader();
      const candidate = candidates[index];
      if (!candidate.startsWith('blob:')) {
        loader.setCrossOrigin('anonymous');
      }

      loader.load(
        candidate,
        (nextTexture) => {
          if (!active) {
            nextTexture.dispose();
            return;
          }
          if (currentTexture && currentTexture !== nextTexture) {
            currentTexture.dispose();
          }
          nextTexture.colorSpace = THREE.SRGBColorSpace;
          nextTexture.minFilter = THREE.LinearFilter;
          nextTexture.magFilter = THREE.LinearFilter;
          currentTexture = nextTexture;
          setTexture(nextTexture);
        },
        undefined,
        () => {
          tryLoad(index + 1);
        }
      );
    };

    tryLoad(0);

    return () => {
      active = false;
      if (currentTexture) {
        currentTexture.dispose();
      }
    };
  }, [urls]);

  return texture;
}

function AngleImageCard({ sourceImage }: { sourceImage: UploadedImage }) {
  const texture = useSourceTexture([sourceImage.previewUrl, sourceImage.url]);
  const aspect = useMemo(() => {
    if (sourceImage.width && sourceImage.height) {
      return sourceImage.width / sourceImage.height;
    }
    const image = texture?.image as { width?: number; height?: number } | undefined;
    if (image?.width && image?.height) {
      return image.width / image.height;
    }
    return 0.72;
  }, [sourceImage.height, sourceImage.width, texture]);
  const maxCardWidth = 4.8;
  const maxCardHeight = 3.15;
  const { cardWidth, cardHeight } = useMemo(() => {
    if (aspect >= 1) {
      const width = maxCardWidth;
      const height = Math.max(1.4, width / aspect);
      return { cardWidth: width, cardHeight: Math.min(height, maxCardHeight) };
    }

    const height = maxCardHeight;
    const width = Math.max(1.4, height * aspect);
    return { cardWidth: Math.min(width, maxCardWidth), cardHeight: height };
  }, [aspect]);
  const frameZ = -0.08;
  const imageZ = 0.065;
  const glossZ = 0.085;

  return (
    <group position={[0, 0.7, 0]}>
      <mesh position={[0, 0.92, frameZ]} castShadow receiveShadow>
        <boxGeometry args={[cardWidth + 0.18, cardHeight + 0.2, 0.1]} />
        <meshStandardMaterial color="#dfe7f2" roughness={0.9} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.92, imageZ]} castShadow receiveShadow>
        <planeGeometry args={[cardWidth, cardHeight]} />
        <meshBasicMaterial
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#c1d0e6'}
          transparent
          alphaTest={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.92, glossZ]} castShadow>
        <planeGeometry args={[cardWidth + 0.02, cardHeight + 0.02]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.12} roughness={1} metalness={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function AngleToolPage() {
  const { loading: authLoading, user } = useRequireAuth();
  const hasHydratedStorageRef = useRef(false);
  const [engineId, setEngineId] = useState<AngleToolEngineId>(DEFAULT_ENGINE_ID as AngleToolEngineId);
  const [params, setParams] = useState<AngleToolNumericParams>({ rotation: 8, tilt: 2, zoom: 1.2 });
  const [safeMode, setSafeMode] = useState(true);
  const [generateBestAngles, setGenerateBestAngles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sourceImage, setSourceImage] = useState<UploadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AngleToolResponse | null>(null);
  const [selectedOutputIndex, setSelectedOutputIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [savingOutputUrl, setSavingOutputUrl] = useState<string | null>(null);
  const [sourceDragActive, setSourceDragActive] = useState(false);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [activeRecentJobId, setActiveRecentJobId] = useState<string | null>(null);
  const [activeRecentOutputIndex, setActiveRecentOutputIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedEngine = useMemo(() => ENGINES.find((engine) => engine.id === engineId) ?? ENGINES[0], [engineId]);
  const effectiveEngineId = useMemo(() => resolveAngleEngineForParams(engineId, params), [engineId, params]);
  const effectiveEngine = useMemo(
    () => ENGINES.find((engine) => engine.id === effectiveEngineId) ?? selectedEngine,
    [effectiveEngineId, selectedEngine]
  );
  const negativeTiltActive = params.tilt < 0;
  const tiltFillPercent = useMemo(() => ((params.tilt + 30) / 60) * 100, [params.tilt]);
  const tiltTrackStyle = useMemo(
    () => ({
      background: `linear-gradient(to right, ${
        negativeTiltActive ? '#d97706' : '#0ea5e9'
      } 0%, ${negativeTiltActive ? '#d97706' : '#0ea5e9'} ${tiltFillPercent}%, #d9e0ea ${tiltFillPercent}%, #d9e0ea 100%)`,
    }),
    [negativeTiltActive, tiltFillPercent]
  );
  const requestedOutputCount = generateBestAngles && effectiveEngine?.supportsMultiOutput ? ANGLE_MULTI_OUTPUT_COUNT : 1;
  const billingProductKey = getAngleBillingProductKey(effectiveEngineId, generateBestAngles);

  const { data: billingProductData } = useSWR(
    `/api/billing-products?productKey=${encodeURIComponent(billingProductKey)}`,
    async (url: string) => {
      const response = await authFetch(url);
      const payload = (await response.json().catch(() => null)) as BillingProductResponse | null;
      if (!response.ok || !payload?.ok || !payload.product) {
        throw new Error(payload?.error ?? 'Unable to load tool pricing');
      }
      return payload.product;
    },
    { keepPreviousData: true }
  );

  const estimatedCostUsd = useMemo(() => {
    if (!billingProductData?.unitPriceCents) return 0;
    return Number((billingProductData.unitPriceCents / 100).toFixed(4));
  }, [billingProductData?.unitPriceCents]);

  const selectedOutput = result?.outputs[selectedOutputIndex] ?? null;
  const { stableJobs: angleJobs } = useInfiniteJobs(12, { surface: 'angle' });
  const recentAngleJobs = useMemo<RecentAngleJobEntry[]>(() => {
    const currentJobId = result?.jobId ?? null;
    return angleJobs
      .filter((job) => job.jobId && job.jobId !== currentJobId)
      .map((job) => {
        const outputs = collectAnglePreviewImages(job.renderIds, job.renderThumbUrls, job.thumbUrl ?? null);
        if (!outputs.length) return null;
        return {
          jobId: job.jobId,
          createdAt: job.createdAt,
          engineLabel: job.engineLabel,
          outputs,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .slice(0, 8);
  }, [angleJobs, result?.jobId]);
  const activeRecentJob = useMemo(
    () => recentAngleJobs.find((entry) => entry.jobId === activeRecentJobId) ?? null,
    [activeRecentJobId, recentAngleJobs]
  );
  const activeRecentOutput = activeRecentJob?.outputs[activeRecentOutputIndex] ?? activeRecentJob?.outputs[0] ?? null;

  useEffect(() => {
    return () => {
      cleanupSourcePreview(sourceImage);
    };
  }, [sourceImage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasHydratedStorageRef.current) return;
    hasHydratedStorageRef.current = true;
    try {
      const stored = window.localStorage.getItem(ANGLE_TOOL_STORAGE_KEY);
      if (!stored) return;
      const parsed = parsePersistedAngleToolState(stored);
      if (!parsed) return;
      setEngineId(parsed.engineId);
      setParams(parsed.params);
      setSafeMode(parsed.safeMode);
      setGenerateBestAngles(parsed.generateBestAngles);
      setSourceImage(parsed.sourceImage);
      setResult(parsed.result);
      setSelectedOutputIndex(parsed.selectedOutputIndex);
    } catch {
      // ignore storage failures
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasHydratedStorageRef.current) return;
    const payload: PersistedAngleToolState = {
      version: 1,
      engineId,
      params,
      safeMode,
      generateBestAngles,
      sourceImage: sourceImage
        ? {
            ...sourceImage,
            previewUrl: sourceImage.previewUrl?.startsWith('blob:') ? sourceImage.url : sourceImage.previewUrl ?? sourceImage.url,
          }
        : null,
      result,
      selectedOutputIndex,
    };
    try {
      window.localStorage.setItem(ANGLE_TOOL_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
  }, [engineId, generateBestAngles, params, result, safeMode, selectedOutputIndex, sourceImage]);

  useEffect(() => {
    if (effectiveEngineId !== engineId) {
      setEngineId(effectiveEngineId);
    }
  }, [effectiveEngineId, engineId]);

  useEffect(() => {
    if (!result?.outputs?.length) {
      if (selectedOutputIndex !== 0) setSelectedOutputIndex(0);
      return;
    }
    if (selectedOutputIndex >= result.outputs.length) {
      setSelectedOutputIndex(0);
    }
  }, [result?.outputs, selectedOutputIndex]);

  useEffect(() => {
    if (!activeRecentJob?.outputs?.length) {
      if (activeRecentOutputIndex !== 0) setActiveRecentOutputIndex(0);
      return;
    }
    if (activeRecentOutputIndex >= activeRecentJob.outputs.length) {
      setActiveRecentOutputIndex(0);
    }
  }, [activeRecentJob?.outputs, activeRecentOutputIndex]);

  const handleParamChange = (key: keyof AngleToolNumericParams) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setParams((previous) => sanitizeParams({ ...previous, [key]: value }));
  };

  const handleSourceFile = async (file: File | null) => {
    if (!file) return;
    const localPreviewUrl = URL.createObjectURL(file);
    setUploading(true);
    setError(null);

    try {
      const uploaded = await uploadImage(file);
      setSourceImage((previous) => {
        cleanupSourcePreview(previous);
        return {
          ...uploaded,
          previewUrl: localPreviewUrl,
          source: 'upload',
        };
      });
      setResult(null);
      setSelectedOutputIndex(0);
    } catch (uploadError) {
      cleanupSourcePreview({ url: '', previewUrl: localPreviewUrl });
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    await handleSourceFile(file);
  };

  const handleSourceUrl = (url: string, source: UploadedImage['source']) => {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      setError('Paste or drop a valid image URL.');
      return;
    }
    setError(null);
    setSourceImage((previous) => {
      cleanupSourcePreview(previous);
      return {
        id: crypto.randomUUID(),
        url: trimmed,
        previewUrl: trimmed,
        name: trimmed.split('/').pop() ?? 'Reference',
        source,
      };
    });
    setResult(null);
    setSelectedOutputIndex(0);
  };

  const handleSourceDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setSourceDragActive(false);
    const files = event.dataTransfer.files;
    if (files && files.length) {
      void handleSourceFile(files[0]);
      return;
    }
    const uri = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');
    if (uri && /^https?:\/\//i.test(uri.trim())) {
      handleSourceUrl(uri, 'paste');
    }
  };

  const handleSourcePaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    const items = clipboard.items;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        void handleSourceFile(file);
        return;
      }
    }
    const text = clipboard.getData('text/plain');
    if (text && /^https?:\/\//i.test(text.trim())) {
      event.preventDefault();
      handleSourceUrl(text, 'paste');
    }
  };

  const handleLibrarySelect = (asset: LibraryAsset) => {
    setSourceImage((previous) => {
      cleanupSourcePreview(previous);
      return {
        id: asset.id,
        url: asset.url,
        previewUrl: asset.url,
        width: asset.width,
        height: asset.height,
        name: asset.url.split('/').pop() ?? 'Library image',
        source: 'library',
      };
    });
    setResult(null);
    setSelectedOutputIndex(0);
    setError(null);
    setLibraryModalOpen(false);
  };

  const handleGenerate = async () => {
    if (!sourceImage?.url) {
      setError('Upload a source image first.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const normalizedParams = sanitizeParams(params);
      const resolvedEngineId = resolveAngleEngineForParams(engineId, normalizedParams);
      setParams(normalizedParams);
      const response = await runAngleTool({
        imageUrl: sourceImage.url,
        engineId: resolvedEngineId,
        params: normalizedParams,
        safeMode,
        generateBestAngles,
        imageWidth: sourceImage.width ?? undefined,
        imageHeight: sourceImage.height ?? undefined,
      });

      setResult(response);
      setSelectedOutputIndex(0);

      emitClientMetric('tool_angle_generate', {
        engineId: response.engineId,
        latencyMs: response.latencyMs,
        estimatedCostUsd: response.pricing.estimatedCostUsd,
        actualCostUsd: response.pricing.actualCostUsd ?? null,
        estimatedCredits: response.pricing.estimatedCredits,
        actualCredits: response.pricing.actualCredits ?? null,
        generateBestAngles,
        requestedOutputCount: response.requestedOutputCount,
        params: response.applied,
      });
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddOutputToLibrary = async (url: string, jobId?: string | null) => {
    setSavingOutputUrl(url);
    try {
      await saveImageToLibrary({
        url,
        jobId: jobId ?? result?.jobId ?? result?.requestId ?? result?.providerJobId ?? null,
        label: 'Angle Output',
        source: 'angle',
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Library save failed');
    } finally {
      setSavingOutputUrl((current) => (current === url ? null : current));
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
            <div className="w-full animate-pulse space-y-4 rounded-card border border-border bg-surface p-8">
              <div className="h-4 w-40 rounded bg-surface-2" />
              <div className="h-10 w-72 rounded bg-surface-2" />
              <div className="h-72 rounded bg-surface-2" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!FEATURES.workflows.toolsSection) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
            <div className="w-full rounded-card border border-border bg-surface p-6">
              <h1 className="text-2xl font-semibold text-text-primary">Tools are disabled</h1>
              <p className="mt-2 text-sm text-text-secondary">Enable `FEATURES.workflows.toolsSection` to access this area.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0 flex-col md:flex-row">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
          <div className="w-full space-y-6">
            <div>
              <ButtonLink href="/tools" variant="outline" linkComponent={Link} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Tools
              </ButtonLink>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
              <Card className="border border-border bg-surface p-5">
                <div className="space-y-5">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Engine</p>
                        <label className="mt-2 block">
                          <span className="sr-only">Engine selection</span>
                          <select
                            value={engineId}
                            onChange={(event) => setEngineId(event.target.value as AngleToolEngineId)}
                            className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                          >
                            {ENGINES.map((engine) => (
                              <option key={engine.id} value={engine.id}>
                                {engine.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="mt-2 text-xs text-text-muted">{selectedEngine?.description}</p>
                        {engineId === 'flux-multiple-angles' ? (
                          <p className="mt-1 text-xs text-text-muted">
                            FLUX supports eye-level to high-angle only. Negative tilt switches to Qwen automatically for low-angle shots.
                          </p>
                        ) : null}
                        {engineId === 'qwen-multiple-angles' && params.tilt < 0 ? (
                          <p className="mt-1 text-xs text-warning">Low-angle shot detected. Qwen Multiple Angles is now active.</p>
                        ) : null}
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Source image</p>
                        <div
                          className={clsx(
                            'mt-2 rounded-card border border-dashed bg-bg p-4 transition',
                            sourceDragActive ? 'border-brand bg-brand/5' : 'border-border'
                          )}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'copy';
                            setSourceDragActive(true);
                          }}
                          onDragLeave={(event) => {
                            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                            setSourceDragActive(false);
                          }}
                          onDrop={handleSourceDrop}
                          onPaste={handleSourcePaste}
                          tabIndex={0}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                          {sourceImage?.url ? (
                            <div className="overflow-hidden rounded-card border border-border bg-bg">
                              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                                <div>
                                  <p className="text-sm font-medium text-text-primary">Source image ready</p>
                                  <p className="text-xs text-text-muted">
                                    {sourceImage?.width && sourceImage?.height
                                      ? `${sourceImage.width} x ${sourceImage.height}`
                                      : sourceImage.source === 'library'
                                        ? 'From Library'
                                        : sourceImage.source === 'paste'
                                          ? 'From pasted URL'
                                          : 'Uploaded from device'}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                  >
                                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    {uploading ? 'Uploading...' : 'Replace'}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => setLibraryModalOpen(true)}
                                  >
                                    <Images className="h-4 w-4" />
                                    Library
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => {
                                      setSourceImage((previous) => {
                                        cleanupSourcePreview(previous);
                                        return null;
                                      });
                                      setResult(null);
                                      setSelectedOutputIndex(0);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                    Remove
                                  </Button>
                                </div>
                              </div>
                              <div className="overflow-hidden bg-bg">
                                <img src={sourceImage.url} alt="Source" className="h-56 w-full object-contain" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-bg px-4 text-center">
                              <div>
                                <p className="text-sm font-medium text-text-primary">Add a source image</p>
                                <p className="mt-1 text-xs text-text-muted">Drop, paste, upload, or choose from your Library.</p>
                              </div>
                              <div className="flex flex-wrap justify-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={uploading}
                                >
                                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                  {uploading ? 'Uploading...' : 'Upload'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => setLibraryModalOpen(true)}
                                >
                                  <Images className="h-4 w-4" />
                                  Library
                                </Button>
                              </div>
                              <p className="text-[11px] text-text-muted">PNG / JPG / WEBP</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <AngleOrbitSelector
                      params={params}
                      onParamsChange={setParams}
                      generateBestAngles={generateBestAngles}
                      onGenerateBestAnglesChange={setGenerateBestAngles}
                      supportsMultiOutput={Boolean(selectedEngine?.supportsMultiOutput)}
                      sourceImage={sourceImage}
                    />
                  </div>

                  <div className="space-y-3 rounded-card border border-border bg-bg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Camera controls</p>
                    </div>

                    <label className="block">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-text-primary">Rotation (0-360)</span>
                        <span className="text-text-muted">{params.rotation.toFixed(0)} deg</span>
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
                        <span className="font-medium text-text-primary">Tilt (-30 to +30)</span>
                        <span className="text-text-muted">{params.tilt.toFixed(0)} deg</span>
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
                        <span className="font-medium text-text-primary">Zoom (0 to 10)</span>
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

                  <div className="rounded-card border border-border bg-bg p-4">
                    <p className="text-xs uppercase tracking-micro text-text-muted">Estimated cost per run</p>
                    <p className="mt-2 text-2xl font-semibold leading-none text-text-primary">
                      {formatUsdCompact(estimatedCostUsd)}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    className="w-full gap-2"
                    onClick={handleGenerate}
                    disabled={generating || uploading || !sourceImage?.url}
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                    {generating ? 'Generating...' : 'Generate'}
                  </Button>

                  {error ? <p className="text-sm text-error">{error}</p> : null}
                </div>
              </Card>

              <Card className="border border-border bg-surface p-5">
                <div className="flex h-full flex-col gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Output</p>
                    <h2 className="mt-1 text-lg font-semibold text-text-primary">First frame preview</h2>
                  </div>

                  {selectedOutput ? (
                    <>
                      <div className="relative">
                        <AngleOutputMosaic
                          outputs={(result?.outputs ?? []).map((output) => ({ url: output.url, thumbUrl: output.thumbUrl ?? output.url }))}
                          selectedIndex={selectedOutputIndex}
                          onSelect={setSelectedOutputIndex}
                          onDownload={(url) => triggerAppDownload(url, suggestDownloadFilename(url, `angle-preview-${Date.now()}`))}
                          onAddToLibrary={(url) => handleAddOutputToLibrary(url)}
                          libraryDisabled={Boolean(selectedOutput?.persisted) || Boolean(savingOutputUrl)}
                        />

                        {generating ? (
                          <div className="absolute inset-0 flex items-center justify-center rounded-card bg-surface-on-media-dark-45 backdrop-blur-[2px]">
                            <div className="rounded-card border border-white/20 bg-surface-on-media-dark-55 px-4 py-3 text-center text-on-inverse shadow-card">
                              <div className="flex items-center justify-center gap-2 text-sm font-medium">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating new angles...
                              </div>
                              <p className="mt-1 text-xs text-on-inverse/80">Your last output stays visible until the new run is ready.</p>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-card border border-border bg-bg p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                          <span>Latency: {result?.latencyMs ?? 0} ms</span>
                          <span>·</span>
                          <span>{formatUsdCompact(result?.pricing.actualCostUsd ?? result?.pricing.estimatedCostUsd ?? null)}</span>
                        </div>
                        {result?.applied.safeApplied ? (
                          <p className="mt-2 text-xs text-warning">Cinema-safe guardrails were applied to this run.</p>
                        ) : null}
                      </div>

                    </>
                  ) : (
                    <div className="flex min-h-[420px] items-center justify-center rounded-card border border-dashed border-border bg-bg p-6 text-center">
                      <div>
                        {generating ? (
                          <>
                            <div className="flex items-center justify-center gap-2 text-sm font-medium text-text-primary">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generating new angles...
                            </div>
                            <p className="mt-2 text-xs text-text-muted">
                              Your preview will appear here as soon as the run is ready.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-text-primary">No output yet</p>
                            <p className="mt-2 text-xs text-text-muted">
                              Upload an image, tune rotation/tilt/zoom, and click Generate.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {recentAngleJobs.length ? (
                    <div className="rounded-card border border-border bg-bg p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Previous jobs</p>
                        <Link href="/jobs" className="text-xs font-medium text-brand hover:underline">
                          Open Jobs
                        </Link>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {recentAngleJobs.map((entry) => (
                          <button
                            key={entry.jobId}
                            type="button"
                            onClick={() => {
                              setActiveRecentJobId(entry.jobId);
                              setActiveRecentOutputIndex(0);
                            }}
                            className="overflow-hidden rounded-card border border-border bg-surface text-left transition hover:border-brand/40"
                          >
                            <div className="h-20 w-full overflow-hidden bg-bg">
                              <AngleOutputMosaic outputs={entry.outputs} compact />
                            </div>
                            <div className="px-2 py-1.5">
                              <p className="truncate text-[10px] font-medium text-text-primary">{entry.engineLabel}</p>
                              <p className="truncate text-[10px] text-text-muted">
                                {new Date(entry.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
      {activeRecentJob ? (
        <div
          className="fixed inset-0 z-[10040] flex items-center justify-center bg-surface-on-media-dark-60 px-4 py-6"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveRecentJobId(null);
            }
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-modal border border-border bg-surface shadow-float">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Angle job</p>
                <h3 className="mt-1 text-lg font-semibold text-text-primary">{activeRecentJob.engineLabel}</h3>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setActiveRecentJobId(null)}>
                Close
              </Button>
            </div>
            <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5">
              {activeRecentJob.outputs.length > 1 ? (
                <>
                  <AngleOutputMosaic
                    outputs={activeRecentJob.outputs}
                    selectedIndex={activeRecentOutputIndex}
                    onSelect={setActiveRecentOutputIndex}
                    onDownload={(url) => triggerAppDownload(url, suggestDownloadFilename(url, `angle-job-${Date.now()}`))}
                    onAddToLibrary={(url) => handleAddOutputToLibrary(url, activeRecentJob.jobId)}
                    libraryDisabled={Boolean(savingOutputUrl)}
                    singleRow
                  />
                  {activeRecentOutput ? (
                    <div className="relative overflow-hidden rounded-card border border-border bg-bg">
                      <img src={activeRecentOutput.url} alt="" className="max-h-[48vh] w-full object-contain" />
                      <div className="absolute bottom-3 right-3 flex items-center gap-2">
                        <button
                          type="button"
                          title="Add to Library"
                          onClick={() => handleAddOutputToLibrary(activeRecentOutput.url, activeRecentJob.jobId)}
                          disabled={Boolean(savingOutputUrl)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition hover:bg-black/70 disabled:cursor-default disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Download"
                          onClick={() => triggerAppDownload(activeRecentOutput.url, suggestDownloadFilename(activeRecentOutput.url, `angle-job-${Date.now()}`))}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition hover:bg-black/70"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : activeRecentOutput ? (
                <div className="relative overflow-hidden rounded-card border border-border bg-bg">
                  <img src={activeRecentOutput.url} alt="" className="max-h-[60vh] w-full object-contain" />
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <button
                      type="button"
                      title="Add to Library"
                      onClick={() => handleAddOutputToLibrary(activeRecentOutput.url, activeRecentJob.jobId)}
                      disabled={Boolean(savingOutputUrl)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition hover:bg-black/70 disabled:cursor-default disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Download"
                      onClick={() => triggerAppDownload(activeRecentOutput.url, suggestDownloadFilename(activeRecentOutput.url, `angle-job-${Date.now()}`))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition hover:bg-black/70"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 text-sm text-text-secondary">
                <span>{new Date(activeRecentJob.createdAt).toLocaleString()}</span>
                <Link href="/jobs" className="font-medium text-brand hover:underline">
                  Open Jobs
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <AngleImageLibraryModal
        open={libraryModalOpen}
        onClose={() => setLibraryModalOpen(false)}
        onSelect={handleLibrarySelect}
      />
    </div>
  );
}

function AngleImageLibraryModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: LibraryAsset) => void;
}) {
  const [activeSource, setActiveSource] = useState<'all' | 'upload' | 'generated'>('all');
  const swrKey = open
    ? activeSource === 'all'
      ? '/api/user-assets?limit=60'
      : `/api/user-assets?limit=60&source=${encodeURIComponent(activeSource)}`
    : null;
  const { data, error, isLoading } = useSWR<LibraryAssetsResponse>(swrKey, async (url: string) => {
    const response = await authFetch(url);
    const payload = (await response.json().catch(() => null)) as LibraryAssetsResponse | null;
    if (!response.ok || !payload?.ok) {
      throw new Error('Failed to load library images');
    }
    return payload;
  });

  const assets = data?.assets ?? [];

  if (!open) return null;

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdropClick}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-modal border border-border bg-surface shadow-float">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Choose from Library</h2>
            <p className="text-xs text-text-secondary">Use an uploaded or saved image as the source frame.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="self-start rounded-full border-border px-3 text-sm font-medium text-text-secondary hover:bg-bg sm:self-auto"
          >
            Close
          </Button>
        </div>
        <div className="border-b border-border px-4 py-3 sm:px-6">
          <div
            role="tablist"
            aria-label="Library image filters"
            className="flex w-full overflow-hidden rounded-full border border-border bg-surface-glass-70 text-xs font-semibold text-text-secondary"
          >
            {([
              ['all', 'All'],
              ['upload', 'Uploaded'],
              ['generated', 'Generated'],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                role="tab"
                variant="ghost"
                size="sm"
                aria-selected={activeSource === value}
                onClick={() => setActiveSource(value)}
                className={clsx(
                  'flex-1 rounded-none px-4 py-2',
                  activeSource === value ? 'bg-brand text-on-brand hover:bg-brand' : 'text-text-secondary hover:bg-surface'
                )}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-6">
          {error ? (
            <div className="rounded-card border border-state-warning/40 bg-state-warning/10 px-4 py-6 text-sm text-state-warning">
              {error instanceof Error ? error.message : 'Failed to load library images'}
            </div>
          ) : isLoading && !assets.length ? (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`angle-library-skeleton-${index}`} className="rounded-card border border-border bg-surface-glass-60 p-0" aria-hidden>
                  <div className="relative aspect-square overflow-hidden rounded-t-card bg-placeholder">
                    <div className="skeleton absolute inset-0" />
                  </div>
                  <div className="border-t border-border px-4 py-3">
                    <div className="h-3 w-24 rounded-full bg-skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
              No images saved yet.
            </div>
          ) : (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onSelect(asset)}
                  className="group block w-full overflow-hidden rounded-card border border-border bg-surface text-left shadow-card transition hover:border-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  <div className="relative aspect-square overflow-hidden rounded-t-card bg-placeholder">
                    <img src={asset.url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 hidden items-center justify-center bg-surface-on-media-dark-40 text-sm font-semibold text-on-inverse group-hover:flex">
                      Use image
                    </div>
                  </div>
                  <div className="min-w-0 space-y-1 border-t border-border px-4 py-3 text-xs text-text-secondary">
                    <p className="truncate text-text-primary">{asset.url.split('/').pop() ?? 'Asset'}</p>
                    {asset.createdAt ? <p className="text-text-muted">{new Date(asset.createdAt).toLocaleString()}</p> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
