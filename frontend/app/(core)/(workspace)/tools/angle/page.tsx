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
import { ArrowLeft, Download, Images, Loader2, Upload, WandSparkles, X } from 'lucide-react';
import * as THREE from 'three';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { listAngleToolEngines } from '@/config/tools-angle-engines';
import { runAngleTool, saveImageToLibrary } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { resolveAngleEngineForParams } from '@/lib/tools-angle';
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

const ENGINES = listAngleToolEngines();
const DEFAULT_ENGINE_ID = ENGINES[0]?.id ?? 'flux-multiple-angles';

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

function triggerDownload(url: string, fileName: string) {
  if (typeof window === 'undefined') return;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function cleanupSourcePreview(image: UploadedImage | null) {
  if (!image?.previewUrl?.startsWith('blob:')) return;
  try {
    URL.revokeObjectURL(image.previewUrl);
  } catch {
    // Ignore preview cleanup failures.
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
        rotation: dragStateRef.current.startRotation + dx * 0.55,
        tilt: dragStateRef.current.startTilt - dy * 0.18,
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
          'relative mx-auto w-full max-w-[360px] touch-none select-none rounded-card border border-border/80 bg-[#0f141c] p-3',
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
      >
        <div className="pointer-events-none relative mx-auto h-[320px] w-[320px] overflow-hidden rounded-card">
          <Canvas
            dpr={[1, 2]}
            camera={{ position: [0, 1.35, 6.4], fov: 32, near: 0.1, far: 50 }}
            gl={{ antialias: true, alpha: false }}
          >
            <color attach="background" args={['#0f141c']} />
            <fog attach="fog" args={['#0f141c', 8, 18]} />
            <ambientLight intensity={1.1} />
            <directionalLight position={[5, 6, 4]} intensity={2.4} color="#eef6ff" />
            <directionalLight position={[-3, 1.5, -4]} intensity={0.85} color="#8fb4ff" />
            <pointLight position={[0, -1.2, 0]} intensity={0.25} color="#5a86d8" />
            <AngleCameraRig params={params} />
            <AngleReferenceScene generateBestAngles={generateBestAngles} sourceImage={sourceImage} />
          </Canvas>

          <button
            type="button"
            className="pointer-events-auto absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-border/80 bg-surface/80 px-2 py-1 text-xs text-text-secondary hover:bg-surface"
            onClick={() => nudge(0, 4)}
          >
            ▲
          </button>
          <button
            type="button"
            className="pointer-events-auto absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-border/80 bg-surface/80 px-2 py-1 text-xs text-text-secondary hover:bg-surface"
            onClick={() => nudge(-12, 0)}
          >
            ◀
          </button>
          <button
            type="button"
            className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-border/80 bg-surface/80 px-2 py-1 text-xs text-text-secondary hover:bg-surface"
            onClick={() => nudge(12, 0)}
          >
            ▶
          </button>
          <button
            type="button"
            className="pointer-events-auto absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border/80 bg-surface/80 px-2 py-1 text-xs text-text-secondary hover:bg-surface"
            onClick={() => nudge(0, -4)}
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
          onChange={(event) => onGenerateBestAnglesChange(event.target.checked)}
        />
        Generate from 6 best angles
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
  generateBestAngles,
  sourceImage,
}: {
  generateBestAngles: boolean;
  sourceImage?: UploadedImage | null;
}) {
  const markerOffsets = generateBestAngles
    ? [
        { rotation: -45, tilt: 10 },
        { rotation: -20, tilt: 18 },
        { rotation: 20, tilt: 18 },
        { rotation: 45, tilt: 8 },
        { rotation: -30, tilt: -10 },
        { rotation: 30, tilt: -10 },
      ]
    : [{ rotation: 0, tilt: 0 }];

  return (
    <>
      <group position={[0, -0.95, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[6.6, 64]} />
          <meshStandardMaterial color="#101824" roughness={0.96} metalness={0.06} />
        </mesh>
        <gridHelper args={[12, 14, '#4d6788', '#223145']} position={[0, 0.01, 0]} />
        <axesHelper args={[1.6]} position={[-2.6, 0.02, -2.6]} />
      </group>

      {sourceImage?.url ? <AngleImageCard sourceImage={sourceImage} /> : null}

      {markerOffsets.map((offset, index) => {
        const yaw = (offset.rotation * Math.PI) / 180;
        const pitch = (offset.tilt / 30) * (Math.PI / 5);
        const distance = 4.8;
        const planarDistance = Math.cos(pitch) * distance;
        const position: [number, number, number] = [
          Math.sin(yaw) * planarDistance,
          1.2 + Math.sin(pitch) * distance * 1.05,
          Math.cos(yaw) * planarDistance,
        ];

        return (
          <group key={`angle-marker-${index}`} position={position}>
            <mesh>
              <sphereGeometry args={[0.11, 18, 18]} />
              <meshStandardMaterial color={index === 0 ? '#f8fafc' : '#8fb3ff'} emissive={index === 0 ? '#94b8ff' : '#365ea6'} emissiveIntensity={1.4} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function useSourceTexture(url?: string | null) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }

    let active = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    loader.load(
      url,
      (nextTexture) => {
        if (!active) {
          nextTexture.dispose();
          return;
        }
        nextTexture.colorSpace = THREE.SRGBColorSpace;
        nextTexture.minFilter = THREE.LinearFilter;
        nextTexture.magFilter = THREE.LinearFilter;
        setTexture(nextTexture);
      },
      undefined,
      () => {
        if (active) {
          setTexture(null);
        }
      }
    );

    return () => {
      active = false;
    };
  }, [url]);

  return texture;
}

function AngleImageCard({ sourceImage }: { sourceImage: UploadedImage }) {
  const texture = useSourceTexture(sourceImage.previewUrl ?? sourceImage.url);
  const aspect = sourceImage.width && sourceImage.height ? sourceImage.width / sourceImage.height : 0.72;
  const cardHeight = 3.15;
  const cardWidth = clamp(cardHeight * aspect, 1.4, 2.5);

  return (
    <group position={[0, 0.7, 0]}>
      <mesh position={[0, 0.92, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[cardWidth + 0.18, cardHeight + 0.2, 0.1]} />
        <meshStandardMaterial color="#1a2535" roughness={0.84} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.92, 0]} castShadow receiveShadow>
        <planeGeometry args={[cardWidth, cardHeight]} />
        <meshBasicMaterial
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#7ca0d2'}
          transparent
          alphaTest={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.92, 0.02]} castShadow>
        <planeGeometry args={[cardWidth + 0.02, cardHeight + 0.02]} />
        <meshStandardMaterial color="#eef4ff" transparent opacity={0.04} roughness={1} metalness={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function AngleToolPage() {
  const { loading: authLoading, user } = useRequireAuth();
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
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [sourceDragActive, setSourceDragActive] = useState(false);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedEngine = useMemo(() => ENGINES.find((engine) => engine.id === engineId) ?? ENGINES[0], [engineId]);
  const effectiveEngineId = useMemo(() => resolveAngleEngineForParams(engineId, params), [engineId, params]);
  const effectiveEngine = useMemo(
    () => ENGINES.find((engine) => engine.id === effectiveEngineId) ?? selectedEngine,
    [effectiveEngineId, selectedEngine]
  );
  const requestedOutputCount = generateBestAngles && effectiveEngine?.supportsMultiOutput ? 6 : 1;
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

  useEffect(() => {
    return () => {
      cleanupSourcePreview(sourceImage);
    };
  }, [sourceImage]);

  useEffect(() => {
    if (effectiveEngineId !== engineId) {
      setEngineId(effectiveEngineId);
    }
  }, [effectiveEngineId, engineId]);

  const handleParamChange = (key: keyof AngleToolNumericParams) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setParams((previous) => sanitizeParams({ ...previous, [key]: value }));
  };

  const handleSourceFile = async (file: File | null) => {
    if (!file) return;
    const localPreviewUrl = URL.createObjectURL(file);
    setUploading(true);
    setError(null);
    setSaveMessage(null);

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
    setSaveMessage(null);
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
    setSaveMessage(null);
    setLibraryModalOpen(false);
  };

  const handleGenerate = async () => {
    if (!sourceImage?.url) {
      setError('Upload a source image first.');
      return;
    }

    setGenerating(true);
    setError(null);
    setSaveMessage(null);

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

  const handleUseFirstFrame = async () => {
    if (!selectedOutput?.url) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const downloadName = `angle-first-frame-${Date.now()}.png`;
      if (!selectedOutput.persisted) {
        await saveImageToLibrary({
          url: selectedOutput.url,
          jobId: result?.jobId ?? result?.requestId ?? result?.providerJobId ?? null,
          label: 'Angle First Frame',
          source: 'angle',
        });
      }
      triggerDownload(selectedOutput.url, downloadName);
      setSaveMessage(
        selectedOutput.persisted
          ? 'Already saved in Library. Downloaded as first frame.'
          : 'Saved to Library and downloaded as first frame.'
      );
    } catch (saveError) {
      triggerDownload(selectedOutput.url, `angle-first-frame-${Date.now()}.png`);
      setSaveMessage(
        saveError instanceof Error
          ? `Saved download only (${saveError.message}).`
          : 'Saved download only (library save failed).'
      );
    } finally {
      setSaving(false);
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
                      <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
                        <input
                          type="checkbox"
                          checked={safeMode}
                          onChange={(event) => setSafeMode(event.target.checked)}
                          className="h-4 w-4 rounded border-border"
                        />
                        Cinema-safe tilt/zoom clamp
                      </label>
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
                        className="w-full"
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
                        className="w-full"
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
                        className="w-full"
                      />
                    </label>
                  </div>

                  <div className="rounded-card border border-border bg-bg p-4">
                    <p className="text-xs uppercase tracking-micro text-text-muted">Estimated cost per run</p>
                    <p className="mt-2 text-2xl font-semibold leading-none text-text-primary">
                      {formatUsd(estimatedCostUsd)} for {requestedOutputCount} output{requestedOutputCount > 1 ? 's' : ''}
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
                      {result && result.outputs.length > 1 ? (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          {result.outputs.map((output, index) => (
                            <button
                              key={`${output.url}-${index}`}
                              type="button"
                              onClick={() => setSelectedOutputIndex(index)}
                              className={clsx(
                                'overflow-hidden rounded-card border bg-bg transition',
                                index === selectedOutputIndex ? 'border-brand ring-1 ring-brand/40' : 'border-border hover:border-brand/40'
                              )}
                            >
                              <img src={output.url} alt={`Angle variant ${index + 1}`} className="h-36 w-full object-cover" />
                              <div className="px-2 py-1 text-left text-[11px] text-text-secondary">
                                Angle {index + 1}
                                {index === selectedOutputIndex ? ' · selected' : ''}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-card border border-border bg-bg">
                          <img src={selectedOutput.url} alt="Generated angle output" className="h-[360px] w-full object-contain" />
                        </div>
                      )}

                      <div className="rounded-card border border-border bg-bg p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                          <span>Latency: {result?.latencyMs ?? 0} ms</span>
                          <span>·</span>
                          <span>Est: {formatUsd(result?.pricing.estimatedCostUsd ?? null)}</span>
                          <span>·</span>
                          <span>Actual: {formatUsd(result?.pricing.actualCostUsd ?? null)}</span>
                          <span>·</span>
                          <span>
                            Credits: {result?.pricing.actualCredits ?? result?.pricing.estimatedCredits ?? Math.max(1, Math.round(estimatedCostUsd * 100))}
                          </span>
                        </div>
                        {result?.applied.safeApplied ? (
                          <p className="mt-2 text-xs text-warning">Cinema-safe guardrails were applied to this run.</p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="primary" onClick={handleUseFirstFrame} disabled={saving} className="gap-2">
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          {saving ? 'Saving...' : 'Use as First Frame'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => triggerDownload(selectedOutput.url, `angle-preview-${Date.now()}.png`)}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download only
                        </Button>
                      </div>

                      {saveMessage ? (
                        <p className="text-sm text-text-secondary">
                          {saveMessage} <Link href="/app/library" className="font-medium text-brand hover:underline">Open Library</Link>
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex min-h-[420px] items-center justify-center rounded-card border border-dashed border-border bg-bg p-6 text-center">
                      <div>
                        <p className="text-sm font-medium text-text-primary">No output yet</p>
                        <p className="mt-2 text-xs text-text-muted">
                          Upload an image, tune rotation/tilt/zoom, and click Generate.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
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
