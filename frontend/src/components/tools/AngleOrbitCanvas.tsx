'use client';

import { useEffect, useRef, useState } from 'react';
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

type OrbitSceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  frameMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  imageMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  glossMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  guidesGroup: THREE.Group;
  animationFrame: number | null;
  resizeObserver: ResizeObserver | null;
  texture: THREE.Texture | null;
};

const DEFAULT_ASPECT = 0.72;
const MAX_CARD_WIDTH = 4.8;
const MAX_CARD_HEIGHT = 3.15;
const CAMERA_TARGET = new THREE.Vector3(0, 1.2, 0);

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

function getTextureCandidates(sourceImage?: OrbitSourceImage | null): string[] {
  if (!sourceImage) return [];
  return [buildTextureProxyUrl(sourceImage.previewUrl), buildTextureProxyUrl(sourceImage.url)]
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry, index, array) => entry.length > 0 && array.indexOf(entry) === index);
}

function resolveCardSize(aspect: number): { width: number; height: number } {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : DEFAULT_ASPECT;
  if (safeAspect >= 1) {
    const width = MAX_CARD_WIDTH;
    const height = Math.max(1.4, width / safeAspect);
    return { width, height: Math.min(height, MAX_CARD_HEIGHT) };
  }

  const height = MAX_CARD_HEIGHT;
  const width = Math.max(1.4, height * safeAspect);
  return { width: Math.min(width, MAX_CARD_WIDTH), height };
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }
  material.dispose();
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      disposeMaterial(mesh.material);
    }
  });
}

function setCardAspect(state: OrbitSceneState, aspect: number) {
  const { width, height } = resolveCardSize(aspect);
  state.frameMesh.scale.set(width + 0.18, height + 0.2, 0.1);
  state.imageMesh.scale.set(width, height, 1);
  state.glossMesh.scale.set(width + 0.02, height + 0.02, 1);
}

function setImageTexture(state: OrbitSceneState, texture: THREE.Texture | null) {
  if (state.texture && state.texture !== texture) {
    state.texture.dispose();
  }
  state.texture = texture;
  state.imageMesh.material.map = texture ?? null;
  state.imageMesh.material.color.set(texture ? '#ffffff' : '#c1d0e6');
  state.imageMesh.material.needsUpdate = true;
}

function updateGuides(state: OrbitSceneState, params: AngleToolNumericParams, generateBestAngles: boolean) {
  state.guidesGroup.children.forEach((child) => {
    disposeObject(child);
  });
  state.guidesGroup.clear();

  if (!generateBestAngles) return;

  const guideColor = '#97a8c2';
  const offsets = buildBestAngleVariantParams(params);
  offsets.forEach((offset) => {
    const yaw = (offset.rotation * Math.PI) / 180;
    const pitch = (offset.tilt / 30) * (Math.PI / 5);
    const distance = 4.8;
    const planarDistance = Math.cos(pitch) * distance;
    const position = new THREE.Vector3(
      Math.sin(yaw) * planarDistance,
      1.2 + Math.sin(pitch) * distance * 1.05,
      Math.cos(yaw) * planarDistance
    );
    const geometry = new THREE.BufferGeometry().setFromPoints([CAMERA_TARGET.clone(), position]);
    const material = new THREE.LineBasicMaterial({ color: guideColor, transparent: true, opacity: 0.8 });
    state.guidesGroup.add(new THREE.Line(geometry, material));
  });
}

function updateCamera(camera: THREE.PerspectiveCamera, params: AngleToolNumericParams) {
  const yaw = (params.rotation * Math.PI) / 180;
  const pitch = (params.tilt / 30) * (Math.PI / 5);
  const distance = 8.3 - params.zoom * 0.46;
  const planarDistance = Math.cos(pitch) * distance;
  const desiredPosition = new THREE.Vector3(
    Math.sin(yaw) * planarDistance,
    1.15 + Math.sin(pitch) * distance * 1.1,
    Math.cos(yaw) * planarDistance
  );

  camera.position.lerp(desiredPosition, 0.16);
  camera.lookAt(CAMERA_TARGET);

  const nextFov = clamp(32 - params.zoom * 0.72, 20, 32);
  if (Math.abs(camera.fov - nextFov) > 0.01) {
    camera.fov = nextFov;
    camera.updateProjectionMatrix();
  }
}

function createScene(mount: HTMLDivElement): OrbitSceneState {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f6f8fc');
  scene.fog = new THREE.Fog('#f6f8fc', 10, 22);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 1.35, 6.4);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor('#f6f8fc', 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'block h-full w-full';
  mount.appendChild(renderer.domElement);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(6.6, 64),
    new THREE.MeshStandardMaterial({ color: '#eef2f9', roughness: 0.98, metalness: 0.02 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.95;
  ground.receiveShadow = true;
  scene.add(ground);

  const guidesGroup = new THREE.Group();
  scene.add(guidesGroup);

  const cardGroup = new THREE.Group();
  cardGroup.position.set(0, 0.7, 0);
  scene.add(cardGroup);

  const frameMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#dfe7f2', roughness: 0.9, metalness: 0.04 })
  );
  frameMesh.position.set(0, 0.92, -0.08);
  frameMesh.castShadow = true;
  frameMesh.receiveShadow = true;
  cardGroup.add(frameMesh);

  const imageMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: '#c1d0e6', transparent: true, alphaTest: 0.04, side: THREE.DoubleSide })
  );
  imageMesh.position.set(0, 0.92, 0.065);
  imageMesh.castShadow = true;
  imageMesh.receiveShadow = true;
  cardGroup.add(imageMesh);

  const glossMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.12,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  glossMesh.position.set(0, 0.92, 0.085);
  glossMesh.castShadow = true;
  cardGroup.add(glossMesh);

  scene.add(new THREE.AmbientLight('#ffffff', 1.3));
  const mainLight = new THREE.DirectionalLight('#ffffff', 2.1);
  mainLight.position.set(5, 6, 4);
  scene.add(mainLight);
  const fillLight = new THREE.DirectionalLight('#dbe6f7', 0.65);
  fillLight.position.set(-3, 1.5, -4);
  scene.add(fillLight);
  const floorLight = new THREE.PointLight('#cddaf0', 0.16);
  floorLight.position.set(0, -1.2, 0);
  scene.add(floorLight);

  const state: OrbitSceneState = {
    renderer,
    scene,
    camera,
    frameMesh,
    imageMesh,
    glossMesh,
    guidesGroup,
    animationFrame: null,
    resizeObserver: null,
    texture: null,
  };
  setCardAspect(state, DEFAULT_ASPECT);
  return state;
}

export default function AngleOrbitCanvas({ params, sourceImage, generateBestAngles }: AngleOrbitCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<OrbitSceneState | null>(null);
  const paramsRef = useRef(params);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let state: OrbitSceneState;
    try {
      state = createScene(mount);
    } catch {
      setWebglUnavailable(true);
      return;
    }

    sceneRef.current = state;

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      state.renderer.setSize(width, height, false);
      state.camera.aspect = width / height;
      state.camera.updateProjectionMatrix();
    };

    resize();
    state.resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    state.resizeObserver?.observe(mount);

    const render = () => {
      updateCamera(state.camera, paramsRef.current);
      state.renderer.render(state.scene, state.camera);
      state.animationFrame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      if (state.animationFrame !== null) {
        window.cancelAnimationFrame(state.animationFrame);
      }
      state.resizeObserver?.disconnect();
      setImageTexture(state, null);
      disposeObject(state.scene);
      state.renderer.dispose();
      state.renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    updateGuides(state, params, generateBestAngles);
  }, [generateBestAngles, params]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;

    let active = true;
    const candidates = getTextureCandidates(sourceImage);
    if (!candidates.length) {
      setImageTexture(state, null);
      setCardAspect(state, DEFAULT_ASPECT);
      return;
    }

    const loadCandidate = (index: number) => {
      if (!active || index >= candidates.length) {
        if (active) {
          setImageTexture(state, null);
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
        (texture) => {
          if (!active) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          setImageTexture(state, texture);
          const image = texture.image as { width?: number; height?: number } | undefined;
          const aspect =
            sourceImage?.width && sourceImage.height
              ? sourceImage.width / sourceImage.height
              : image?.width && image.height
                ? image.width / image.height
                : DEFAULT_ASPECT;
          setCardAspect(state, aspect);
        },
        undefined,
        () => loadCandidate(index + 1)
      );
    };

    loadCandidate(0);

    return () => {
      active = false;
    };
  }, [sourceImage]);

  if (webglUnavailable) {
    return <div className="h-full w-full bg-[#f6f8fc]" aria-hidden="true" />;
  }

  return <div ref={mountRef} className="h-full w-full" data-angle-orbit-canvas="three" />;
}
