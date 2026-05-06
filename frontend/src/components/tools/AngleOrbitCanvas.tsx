'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildBestAngleVariantParams } from '@/lib/tools-angle';
import type { AngleToolNumericParams } from '@/types/tools-angle';

type OrbitSourceImage = {
  url: string;
  previewUrl?: string | null;
  width?: number | null;
  height?: number | null;
};

type AngleOrbitCanvasProps = {
  params: AngleToolNumericParams;
  sourceImage?: OrbitSourceImage | null;
  generateBestAngles: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildTextureProxyUrl(url: string | null | undefined): string | null {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed) return null;
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return `/api/media-proxy?url=${encodeURIComponent(trimmed)}`;
}

function getTextureCandidates(sourceImage: OrbitSourceImage): string[] {
  return [buildTextureProxyUrl(sourceImage.previewUrl), buildTextureProxyUrl(sourceImage.url)]
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry, index, array) => entry.length > 0 && array.indexOf(entry) === index);
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
  sourceImage?: OrbitSourceImage | null;
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
      if (!candidate.startsWith('blob:') && !candidate.startsWith('/')) {
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

function AngleImageCard({ sourceImage }: { sourceImage: OrbitSourceImage }) {
  const texture = useSourceTexture(getTextureCandidates(sourceImage));
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

export default function AngleOrbitCanvas({ params, sourceImage, generateBestAngles }: AngleOrbitCanvasProps) {
  return (
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
  );
}
