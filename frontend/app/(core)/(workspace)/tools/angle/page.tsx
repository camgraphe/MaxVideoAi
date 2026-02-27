'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, Download, Loader2, Upload, WandSparkles } from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { listAngleToolEngines } from '@/config/tools-angle-engines';
import { runAngleTool, saveImageToLibrary } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { estimateAngleCostUsd } from '@/lib/tools-angle';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FEATURES } from '@/content/feature-flags';
import type {
  AngleToolEngineId,
  AngleToolNumericParams,
  AngleToolPresetId,
  AngleToolResponse,
} from '@/types/tools-angle';

type UploadedImage = {
  url: string;
  width?: number | null;
  height?: number | null;
  name?: string | null;
};

const PRESETS: Record<
  AngleToolPresetId,
  {
    label: string;
    description: string;
    params: AngleToolNumericParams;
  }
> = {
  dialogue: {
    label: 'Dialogue',
    description: 'Subtle camera shift for conversational framing.',
    params: { rotation: 8, tilt: 2, zoom: 1.2 },
  },
  product: {
    label: 'Product',
    description: 'Balanced reveal for hero product angles.',
    params: { rotation: 18, tilt: 6, zoom: 1.8 },
  },
  action: {
    label: 'Action',
    description: 'Dynamic framing while staying cinema-safe.',
    params: { rotation: 25, tilt: 12, zoom: 2.6 },
  },
};

const ENGINES = listAngleToolEngines();
const DEFAULT_ENGINE_ID = ENGINES[0]?.id ?? 'flux-multiple-angles';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeRotation(value: number): number {
  return ((value % 360) + 360) % 360;
}

function sanitizeParams(params: AngleToolNumericParams): AngleToolNumericParams {
  return {
    rotation: normalizeRotation(params.rotation),
    tilt: clamp(params.tilt, -30, 30),
    zoom: clamp(params.zoom, 0, 10),
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
}: {
  params: AngleToolNumericParams;
  onParamsChange: (next: AngleToolNumericParams) => void;
  generateBestAngles: boolean;
  onGenerateBestAnglesChange: (value: boolean) => void;
  supportsMultiOutput: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = 320;
    const height = 320;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const radius = 108;
    const yaw = (params.rotation * Math.PI) / 180;
    const pitch = (-params.tilt / 30) * (Math.PI / 4);
    const perspective = 430;

    type Point3D = { x: number; y: number; z: number };
    type Projected = { x: number; y: number; z: number };

    const rotate = (point: Point3D): Point3D => {
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      const x1 = point.x * cosY + point.z * sinY;
      const z1 = -point.x * sinY + point.z * cosY;
      const y2 = point.y * cosP - z1 * sinP;
      const z2 = point.y * sinP + z1 * cosP;
      return { x: x1, y: y2, z: z2 };
    };

    const project = (point: Point3D): Projected => {
      const scale = perspective / (perspective - point.z);
      return {
        x: cx + point.x * scale,
        y: cy - point.y * scale,
        z: point.z,
      };
    };

    const drawCurve = (points: Projected[]) => {
      for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1];
        const b = points[i];
        const zAvg = (a.z + b.z) / 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        if (zAvg < 0) {
          ctx.strokeStyle = 'rgba(109, 124, 148, 0.16)';
          ctx.lineWidth = 0.6;
        } else {
          ctx.strokeStyle = 'rgba(151, 170, 204, 0.33)';
          ctx.lineWidth = 0.95;
        }
        ctx.stroke();
      }
    };

    const glow = ctx.createRadialGradient(cx, cy, 30, cx, cy, radius + 42);
    glow.addColorStop(0, 'rgba(126, 152, 198, 0.28)');
    glow.addColorStop(0.5, 'rgba(74, 95, 124, 0.14)');
    glow.addColorStop(1, 'rgba(20, 27, 38, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 34, 0, Math.PI * 2);
    ctx.fill();

    const sphereFill = ctx.createRadialGradient(cx - 22, cy - 30, 10, cx, cy, radius + 10);
    sphereFill.addColorStop(0, 'rgba(57, 71, 93, 0.42)');
    sphereFill.addColorStop(0.6, 'rgba(20, 28, 40, 0.68)');
    sphereFill.addColorStop(1, 'rgba(11, 15, 23, 0.95)');
    ctx.fillStyle = sphereFill;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      const radiusSafe = Math.max(0, Math.min(r, Math.min(w, h) / 2));
      ctx.beginPath();
      ctx.moveTo(x + radiusSafe, y);
      ctx.lineTo(x + w - radiusSafe, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radiusSafe);
      ctx.lineTo(x + w, y + h - radiusSafe);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radiusSafe, y + h);
      ctx.lineTo(x + radiusSafe, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radiusSafe);
      ctx.lineTo(x, y + radiusSafe);
      ctx.quadraticCurveTo(x, y, x + radiusSafe, y);
      ctx.closePath();
    };

    const drawCameraGlyph = (
      cameraProjected: Projected,
      options: { opacity: number; dashedRay?: boolean; depth: number; behind: boolean }
    ) => {
      ctx.save();
      ctx.globalAlpha = options.opacity;
      if (options.dashedRay) {
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
      }

      const rayGradient = ctx.createLinearGradient(cameraProjected.x, cameraProjected.y, cx, cy);
      rayGradient.addColorStop(0, options.behind ? 'rgba(190, 204, 228, 0.46)' : 'rgba(255, 255, 255, 0.96)');
      rayGradient.addColorStop(1, options.behind ? 'rgba(164, 180, 208, 0.24)' : 'rgba(194, 212, 243, 0.64)');
      ctx.beginPath();
      ctx.moveTo(cameraProjected.x, cameraProjected.y);
      ctx.lineTo(cx, cy);
      ctx.strokeStyle = rayGradient;
      ctx.lineWidth = 1.65;
      ctx.stroke();
      ctx.setLineDash([]);

      const depthRatio = (options.depth + radius) / (radius * 2);
      const scale = (generateBestAngles ? 0.76 : 0.92) + depthRatio * 0.36;
      const angleToCenter = Math.atan2(cy - cameraProjected.y, cx - cameraProjected.x);

      ctx.translate(cameraProjected.x, cameraProjected.y);
      ctx.rotate(angleToCenter);
      ctx.scale(scale, scale);

      ctx.fillStyle = options.behind ? 'rgba(6, 10, 16, 0.42)' : 'rgba(7, 12, 18, 0.55)';
      ctx.beginPath();
      ctx.ellipse(1.5, 8.5, 13.8, 5.8, 0, 0, Math.PI * 2);
      ctx.fill();

      const bodyGradient = ctx.createLinearGradient(-12, -9, 10, 9);
      if (options.behind) {
        bodyGradient.addColorStop(0, 'rgba(54, 66, 88, 0.82)');
        bodyGradient.addColorStop(1, 'rgba(27, 35, 50, 0.88)');
      } else {
        bodyGradient.addColorStop(0, 'rgba(128, 148, 182, 0.96)');
        bodyGradient.addColorStop(1, 'rgba(51, 67, 95, 0.98)');
      }
      drawRoundedRect(-12, -8.5, 18.5, 16.5, 4.2);
      ctx.fillStyle = bodyGradient;
      ctx.fill();
      ctx.strokeStyle = options.behind ? 'rgba(137, 157, 191, 0.38)' : 'rgba(214, 230, 255, 0.68)';
      ctx.lineWidth = 1.1;
      ctx.stroke();

      const topGradient = ctx.createLinearGradient(-6, -13, 3.5, -7);
      topGradient.addColorStop(0, options.behind ? 'rgba(64, 78, 105, 0.74)' : 'rgba(173, 191, 219, 0.94)');
      topGradient.addColorStop(1, options.behind ? 'rgba(38, 48, 67, 0.78)' : 'rgba(92, 110, 144, 0.96)');
      drawRoundedRect(-6.8, -12.6, 10.8, 5, 2);
      ctx.fillStyle = topGradient;
      ctx.fill();
      ctx.strokeStyle = options.behind ? 'rgba(144, 164, 195, 0.3)' : 'rgba(220, 234, 255, 0.64)';
      ctx.lineWidth = 0.85;
      ctx.stroke();

      const lensBarrel = ctx.createLinearGradient(5, -6, 17, 6);
      lensBarrel.addColorStop(0, options.behind ? 'rgba(72, 85, 108, 0.7)' : 'rgba(168, 189, 222, 0.92)');
      lensBarrel.addColorStop(1, options.behind ? 'rgba(28, 38, 57, 0.84)' : 'rgba(43, 58, 88, 0.96)');
      drawRoundedRect(5.8, -6.8, 12.6, 13.6, 4.5);
      ctx.fillStyle = lensBarrel;
      ctx.fill();
      ctx.strokeStyle = options.behind ? 'rgba(130, 151, 184, 0.36)' : 'rgba(229, 241, 255, 0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(11.8, 0, 4.35, 0, Math.PI * 2);
      ctx.fillStyle = options.behind ? 'rgba(14, 21, 34, 0.86)' : 'rgba(22, 34, 56, 0.98)';
      ctx.fill();
      ctx.strokeStyle = options.behind ? 'rgba(156, 177, 207, 0.42)' : 'rgba(208, 227, 255, 0.88)';
      ctx.lineWidth = 1.15;
      ctx.stroke();

      const lensGlass = ctx.createRadialGradient(10.8, -1.3, 0.5, 11.8, 0, 4.8);
      lensGlass.addColorStop(0, options.behind ? 'rgba(150, 181, 229, 0.5)' : 'rgba(218, 238, 255, 0.98)');
      lensGlass.addColorStop(0.45, options.behind ? 'rgba(82, 126, 200, 0.48)' : 'rgba(108, 163, 255, 0.92)');
      lensGlass.addColorStop(1, options.behind ? 'rgba(22, 42, 75, 0.58)' : 'rgba(17, 33, 63, 0.92)');
      ctx.beginPath();
      ctx.arc(11.8, 0, 3.15, 0, Math.PI * 2);
      ctx.fillStyle = lensGlass;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(-5.7, -1.2, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = options.behind ? 'rgba(126, 145, 175, 0.44)' : 'rgba(170, 191, 224, 0.88)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(12.8, -1.4, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();

      ctx.strokeStyle = options.behind ? 'rgba(146, 163, 191, 0.3)' : 'rgba(240, 248, 255, 0.58)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-8.4, 3.8);
      ctx.lineTo(3.2, 3.8);
      ctx.stroke();
      ctx.restore();
    };

    const cameraLocal: Point3D = { x: 0, y: 0, z: radius + 6 };
    const angleOffsets = generateBestAngles
      ? [
          { yaw: -45, tilt: 10 },
          { yaw: -20, tilt: 18 },
          { yaw: 20, tilt: 18 },
          { yaw: 45, tilt: 8 },
          { yaw: -30, tilt: -10 },
          { yaw: 30, tilt: -10 },
        ]
      : [{ yaw: 0, tilt: 0 }];

    const cameraMarkers = angleOffsets.map((offset) => {
      const markerYaw = ((params.rotation + offset.yaw) * Math.PI) / 180;
      const markerPitch = (-(params.tilt + offset.tilt) / 30) * (Math.PI / 4);
      const cosY = Math.cos(markerYaw);
      const sinY = Math.sin(markerYaw);
      const cosP = Math.cos(markerPitch);
      const sinP = Math.sin(markerPitch);
      const x1 = cameraLocal.x * cosY + cameraLocal.z * sinY;
      const z1 = -cameraLocal.x * sinY + cameraLocal.z * cosY;
      const y2 = cameraLocal.y * cosP - z1 * sinP;
      const z2 = cameraLocal.y * sinP + z1 * cosP;
      const rotated = { x: x1, y: y2, z: z2 };
      return {
        projected: project(rotated),
        behind: rotated.z < 0,
        depth: rotated.z,
      };
    });

    cameraMarkers
      .filter((marker) => marker.behind)
      .forEach((marker) =>
        drawCameraGlyph(marker.projected, { opacity: 0.34, dashedRay: true, depth: marker.depth, behind: true })
      );

    for (let lonDeg = 0; lonDeg < 180; lonDeg += 15) {
      const lon = (lonDeg * Math.PI) / 180;
      const points: Projected[] = [];
      for (let latDeg = -90; latDeg <= 90; latDeg += 2) {
        const lat = (latDeg * Math.PI) / 180;
        const base = {
          x: radius * Math.cos(lat) * Math.cos(lon),
          y: radius * Math.sin(lat),
          z: radius * Math.cos(lat) * Math.sin(lon),
        };
        points.push(project(rotate(base)));
      }
      drawCurve(points);
    }

    for (let latDeg = -75; latDeg <= 75; latDeg += 15) {
      const lat = (latDeg * Math.PI) / 180;
      const points: Projected[] = [];
      for (let lonDeg = 0; lonDeg <= 360; lonDeg += 2) {
        const lon = (lonDeg * Math.PI) / 180;
        const base = {
          x: radius * Math.cos(lat) * Math.cos(lon),
          y: radius * Math.sin(lat),
          z: radius * Math.cos(lat) * Math.sin(lon),
        };
        points.push(project(rotate(base)));
      }
      drawCurve(points);
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(191, 210, 237, 0.28)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    if (cameraMarkers.some((marker) => marker.behind)) {
      const occlusion = ctx.createRadialGradient(cx - 20, cy - 24, 8, cx, cy, radius + 8);
      occlusion.addColorStop(0, 'rgba(20, 28, 40, 0.18)');
      occlusion.addColorStop(0.7, 'rgba(14, 20, 30, 0.30)');
      occlusion.addColorStop(1, 'rgba(11, 15, 23, 0.50)');
      ctx.fillStyle = occlusion;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const cubeSize = 18;
    const cubeVertices: Point3D[] = [
      { x: -cubeSize, y: -cubeSize, z: -cubeSize },
      { x: cubeSize, y: -cubeSize, z: -cubeSize },
      { x: -cubeSize, y: cubeSize, z: -cubeSize },
      { x: cubeSize, y: cubeSize, z: -cubeSize },
      { x: -cubeSize, y: -cubeSize, z: cubeSize },
      { x: cubeSize, y: -cubeSize, z: cubeSize },
      { x: -cubeSize, y: cubeSize, z: cubeSize },
      { x: cubeSize, y: cubeSize, z: cubeSize },
    ];
    const rotatedCube = cubeVertices.map((vertex) => rotate(vertex));
    const projectedCube = rotatedCube.map((vertex) => project(vertex));

    const cubeFaces = [
      { indices: [0, 2, 6, 4], fill: 'rgba(124, 142, 175, 0.26)' },
      { indices: [1, 5, 7, 3], fill: 'rgba(168, 184, 214, 0.30)' },
      { indices: [0, 1, 5, 4], fill: 'rgba(94, 110, 139, 0.24)' },
      { indices: [2, 3, 7, 6], fill: 'rgba(156, 172, 203, 0.24)' },
      { indices: [0, 1, 3, 2], fill: 'rgba(72, 84, 108, 0.22)' },
      { indices: [4, 6, 7, 5], fill: 'rgba(188, 205, 236, 0.28)' },
    ]
      .map((face) => {
        const zAvg =
          face.indices.reduce((sum, index) => sum + projectedCube[index].z, 0) /
          face.indices.length;
        return { ...face, zAvg };
      })
      .sort((a, b) => a.zAvg - b.zAvg);

    for (const face of cubeFaces) {
      const [first, ...rest] = face.indices;
      const firstPoint = projectedCube[first];
      ctx.beginPath();
      ctx.moveTo(firstPoint.x, firstPoint.y);
      rest.forEach((index) => {
        const point = projectedCube[index];
        ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fillStyle = face.zAvg >= 0 ? face.fill : face.fill.replace(/0\.\d+\)$/, '0.10)');
      ctx.fill();
    }

    const cubeEdges: Array<[number, number]> = [
      [0, 1], [1, 3], [3, 2], [2, 0],
      [4, 5], [5, 7], [7, 6], [6, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    for (const [from, to] of cubeEdges) {
      const a = projectedCube[from];
      const b = projectedCube[to];
      const zAvg = (a.z + b.z) / 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = zAvg >= 0 ? 'rgba(224, 236, 255, 0.62)' : 'rgba(157, 175, 206, 0.28)';
      ctx.lineWidth = 1.15;
      ctx.stroke();
    }

    const axisLength = 32;
    const centerProjected = project(rotate({ x: 0, y: 0, z: 0 }));
    const axisEndpoints = {
      x: project(rotate({ x: axisLength, y: 0, z: 0 })),
      y: project(rotate({ x: 0, y: axisLength, z: 0 })),
      z: project(rotate({ x: 0, y: 0, z: axisLength })),
    };
    const axisColors = {
      x: 'rgba(236, 127, 127, 0.88)',
      y: 'rgba(126, 222, 157, 0.88)',
      z: 'rgba(129, 168, 255, 0.88)',
    };
    (Object.keys(axisEndpoints) as Array<keyof typeof axisEndpoints>).forEach((key) => {
      const endpoint = axisEndpoints[key];
      ctx.beginPath();
      ctx.moveTo(centerProjected.x, centerProjected.y);
      ctx.lineTo(endpoint.x, endpoint.y);
      ctx.strokeStyle = axisColors[key];
      ctx.lineWidth = 1.35;
      ctx.stroke();
    });

    cameraMarkers
      .filter((marker) => !marker.behind)
      .forEach((marker) => drawCameraGlyph(marker.projected, { opacity: 1, depth: marker.depth, behind: false }));

    ctx.fillStyle = 'rgba(173, 190, 219, 0.78)';
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('FRONT', cx - 19, cy + radius + 16);
    ctx.fillText('TOP', cx - 10, cy - radius - 8);
  }, [generateBestAngles, params.rotation, params.tilt, params.zoom]);

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
        <div className="pointer-events-none relative mx-auto h-[320px] w-[320px]">
          <canvas ref={canvasRef} className="h-full w-full" />

          <button
            type="button"
            className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-border/80 bg-surface/80 px-2 py-1 text-xs text-text-secondary hover:bg-surface"
            onClick={() => nudge(0, 4)}
          >
            ▲
          </button>
          <button
            type="button"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-border/80 bg-surface/80 px-2 py-1 text-xs text-text-secondary hover:bg-surface"
            onClick={() => nudge(-12, 0)}
          >
            ◀
          </button>
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-border/80 bg-surface/80 px-2 py-1 text-xs text-text-secondary hover:bg-surface"
            onClick={() => nudge(12, 0)}
          >
            ▶
          </button>
          <button
            type="button"
            className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border/80 bg-surface/80 px-2 py-1 text-xs text-text-secondary hover:bg-surface"
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedEngine = useMemo(() => ENGINES.find((engine) => engine.id === engineId) ?? ENGINES[0], [engineId]);
  const requestedOutputCount = generateBestAngles && selectedEngine?.supportsMultiOutput ? 6 : 1;

  const estimatedCostUsd = useMemo(() => {
    if (!selectedEngine) return 0;
    return Number((estimateAngleCostUsd(engineId, sourceImage?.width, sourceImage?.height) * requestedOutputCount).toFixed(4));
  }, [engineId, requestedOutputCount, selectedEngine, sourceImage?.height, sourceImage?.width]);

  const selectedOutput = result?.outputs[selectedOutputIndex] ?? null;

  const applyPreset = (presetId: AngleToolPresetId) => {
    const preset = PRESETS[presetId];
    if (!preset) return;
    setParams(preset.params);
    setSafeMode(true);
  };

  const handleParamChange = (key: keyof AngleToolNumericParams) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setParams((previous) => ({ ...previous, [key]: value }));
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    setUploading(true);
    setError(null);
    setSaveMessage(null);

    try {
      const uploaded = await uploadImage(file);
      setSourceImage(uploaded);
      setResult(null);
      setSelectedOutputIndex(0);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
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
      const response = await runAngleTool({
        imageUrl: sourceImage.url,
        engineId,
        params,
        safeMode,
        generateBestAngles,
        imageWidth: sourceImage.width ?? undefined,
        imageHeight: sourceImage.height ?? undefined,
      });

      setResult(response);
      setSelectedOutputIndex(0);

      emitClientMetric('tool_angle_generate', {
        engineId,
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
      await saveImageToLibrary({
        url: selectedOutput.url,
        jobId: result?.requestId ?? result?.providerJobId ?? null,
        label: 'Angle First Frame',
      });

      const downloadName = `angle-first-frame-${Date.now()}.png`;
      triggerDownload(selectedOutput.url, downloadName);
      setSaveMessage('Saved to Library and downloaded as first frame.');
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
            <section className="rounded-card border border-border bg-surface p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Tools / Angle</p>
                  <h1 className="mt-2 text-3xl font-semibold text-text-primary">ANGLE / Perspective</h1>
                  <p className="mt-2 max-w-3xl text-sm text-text-secondary">
                    Generate first-frame images with camera-angle controls, then reuse the best frame in image-to-video workflows.
                  </p>
                </div>
                <ButtonLink href="/tools" variant="outline" linkComponent={Link} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Tools
                </ButtonLink>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <Card className="border border-border bg-surface p-5">
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">1. Source image</p>
                    <div className="mt-2 rounded-card border border-dashed border-border bg-bg p-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {sourceImage?.url ? 'Image ready' : 'Upload your source frame'}
                          </p>
                          <p className="text-xs text-text-muted">
                            {sourceImage?.width && sourceImage?.height
                              ? `${sourceImage.width} x ${sourceImage.height}`
                              : 'PNG / JPG / WEBP'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          {uploading ? 'Uploading...' : sourceImage?.url ? 'Replace image' : 'Upload image'}
                        </Button>
                      </div>

                      {sourceImage?.url ? (
                        <div className="mt-4 overflow-hidden rounded-card border border-border bg-bg">
                          <img src={sourceImage.url} alt="Source" className="h-56 w-full object-contain" />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">2. Engine</p>
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
                  </div>

                  <AngleOrbitSelector
                    params={params}
                    onParamsChange={setParams}
                    generateBestAngles={generateBestAngles}
                    onGenerateBestAnglesChange={setGenerateBestAngles}
                    supportsMultiOutput={Boolean(selectedEngine?.supportsMultiOutput)}
                  />

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">4. Presets (cinema-safe)</p>
                      <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
                        <input
                          type="checkbox"
                          checked={safeMode}
                          onChange={(event) => setSafeMode(event.target.checked)}
                          className="h-4 w-4 rounded border-border"
                        />
                        Cinema safe clamp (rot +/-25, tilt +/-15, zoom &lt;=3)
                      </label>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {(Object.keys(PRESETS) as AngleToolPresetId[]).map((presetId) => {
                        const preset = PRESETS[presetId];
                        return (
                          <button
                            key={presetId}
                            type="button"
                            className="rounded-input border border-border bg-bg px-3 py-2 text-left transition hover:border-brand/40 hover:bg-surface-2"
                            onClick={() => applyPreset(presetId)}
                          >
                            <p className="text-sm font-semibold text-text-primary">{preset.label}</p>
                            <p className="mt-1 text-xs text-text-muted">{preset.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-card border border-border bg-bg p-4">
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
                    <p className="mt-1 text-sm font-semibold text-text-primary">
                      {formatUsd(estimatedCostUsd)} for {requestedOutputCount} output{requestedOutputCount > 1 ? 's' : ''}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Estimated credits: {Math.max(1, Math.round(estimatedCostUsd * 100))} credits
                    </p>
                    <p className="mt-1 text-xs text-text-muted">Real cost is captured from Fal when available and logged with latency.</p>
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
    </div>
  );
}
