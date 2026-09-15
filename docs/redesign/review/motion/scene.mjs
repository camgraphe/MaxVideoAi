import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { phase, mix } from './timeline.mjs';

// Local design experiment. No public MaxVideoAI media readers or APIs are used.
export function createScene(canvas, { mobile }) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'default' });
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const lightBackground = new T.Color('#c8c0b4'), darkBackground = new T.Color('#242824');
  scene.background = lightBackground.clone();
  scene.fog = new T.Fog(scene.background, 22, 65);
  const camera = new T.PerspectiveCamera(37, 1, .1, 100);
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .65;
  room.dispose(); pmrem.dispose();
  const key = new T.DirectionalLight('#fff1d9', 3.6);
  key.position.set(-3, 7, 4); key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .5, far: 25 });
  key.shadow.bias = -.0005; key.shadow.normalBias = .025;
  scene.add(key);
  const rim = new T.DirectionalLight('#ff9e49', 1.6);
  rim.position.set(3, 4, -5); scene.add(rim);
  const fill = new T.HemisphereLight('#d9e4ef', '#837464', .65); scene.add(fill);
  const material = (color, metalness = 0, roughness = .5) => new T.MeshStandardMaterial({ color, metalness, roughness });
  const graphite = material('#323638', .82, .26), silver = material('#b9b9b4', .93, .23);
  const black = material('#101514', .2, .42), stone = material('#343b35', .1, .96);
  const floorMaterial = material('#bdb6aa', .1, .86);
  const floor = new T.Mesh(new T.PlaneGeometry(150, 150), floorMaterial);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.18; floor.receiveShadow = true; scene.add(floor);
  const addBox = (parent, dimensions, position, mat, radius = .04) => {
    const mesh = new T.Mesh(new RoundedBoxGeometry(...dimensions, 3, radius), mat);
    mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };

  const laptop = new T.Group(); scene.add(laptop);
  addBox(laptop, [4.25, .14, 2.65], [0, 0, 0], graphite, .065);
  addBox(laptop, [4.2, .035, 2.6], [0, .075, 0], silver, .035);
  addBox(laptop, [1.28, .012, .67], [0, .103, .78], graphite, .04);
  const keyGeometry = new T.BoxGeometry(.25, .017, .21);
  const keys = new T.InstancedMesh(keyGeometry, black, 65);
  const dummy = new T.Object3D();
  for (let i = 0; i < 65; i++) {
    dummy.position.set((i % 13 - 6) * .29, .11, -.91 + Math.floor(i / 13) * .265);
    dummy.updateMatrix(); keys.setMatrixAt(i, dummy.matrix);
  }
  laptop.add(keys);
  const hinge = new T.Group(); hinge.position.set(0, .11, -1.3); laptop.add(hinge);
  addBox(hinge, [4.25, 2.64, .105], [0, 1.32, 0], graphite, .045);
  addBox(hinge, [4.05, 2.4, .015], [0, 1.36, .06], black, .025);
  const uiCanvas = document.createElement('canvas'); uiCanvas.width = 1024; uiCanvas.height = 640;
  const ctx = uiCanvas.getContext('2d');
  ctx.fillStyle = '#eeeae2'; ctx.fillRect(0, 0, 1024, 640);
  ctx.fillStyle = '#313731'; ctx.font = '600 23px sans-serif'; ctx.fillText('FORM / STUDIO', 45, 48);
  ctx.font = '14px sans-serif'; ctx.fillText('COLLECTION     ABOUT     BAG  (0)', 698, 47);
  ctx.fillStyle = '#707970'; ctx.font = '15px sans-serif'; ctx.fillText('A REFERENCE. A STARTING POINT.', 45, 195);
  ctx.fillStyle = '#313731'; ctx.font = '58px Georgia'; ctx.fillText('Made for', 45, 280); ctx.fillText('the everyday.', 45, 347);
  ctx.fillStyle = '#313731'; ctx.fillRect(46, 408, 180, 43); ctx.fillStyle = '#ffffff'; ctx.font = '14px sans-serif'; ctx.fillText('EXPLORE THE FORM  ↗', 62, 435);
  ctx.fillStyle = '#707970'; ctx.font = '12px sans-serif'; ctx.fillText('ILLUSTRATIVE PROJECT / NOT A LIVE WEBSITE', 45, 603);
  const uiTexture = new T.CanvasTexture(uiCanvas);
  const display = new T.Mesh(new T.PlaneGeometry(3.94, 2.27), new T.MeshBasicMaterial({ map: uiTexture, toneMapped: false }));
  display.position.set(0, 1.36, .073); hinge.add(display);
  const screenImage = new T.Mesh(new T.PlaneGeometry(2.12, 1.91), new T.MeshBasicMaterial({ transparent: true, toneMapped: false }));
  screenImage.position.set(.80, 1.3, .08); hinge.add(screenImage);
  const shoe = new T.Group(); scene.add(shoe);

  const set = new T.Group(); scene.add(set);
  const rocks = [];
  const rockData = [
    { end: [.5, -.91, .5], scale: [2.23, .26, 1.5], from: [-7, -4, 1] },
    { end: [-1.65, -.78, .55], scale: [.7, .43, .85], from: [-8, 2.2, -.6] },
    { end: [2.15, -.83, -.6], scale: [.8, .42, .9], from: [8, -2.5, -2] },
    { end: [1.72, -.96, 1.67], scale: [.56, .25, .4], from: [6, 4, 4] },
    { end: [-.9, -.95, 1.73], scale: [.37, .2, .3], from: [-5, -2, 5] },
  ];
  for (let i = 0; i < rockData.length; i++) {
    const geometry = new T.IcosahedronGeometry(1, 2);
    const positions = geometry.attributes.position;
    for (let n = 0; n < positions.count; n++) {
      const x = positions.getX(n), y = positions.getY(n), z = positions.getZ(n);
      // Coordinate-based noise keeps shared vertices together.
      const noise = 1 + .11 * Math.sin(x * 12 + z * 7 + y * 5 + i);
      positions.setXYZ(n, x * noise, y * noise, z * noise);
    }
    geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, stone); mesh.scale.set(...rockData[i].scale);
    mesh.castShadow = true; mesh.receiveShadow = true; set.add(mesh); rocks.push(mesh);
  }
  const arch = new T.Mesh(new T.TorusGeometry(2.42, .115, 12, 64, Math.PI), silver);
  arch.castShadow = true; set.add(arch);
  const amberMaterial = new T.MeshPhysicalMaterial({ color: '#bc6330', metalness: .28, roughness: .28, side: T.DoubleSide, clearcoat: 1, clearcoatRoughness: .2 });
  const amber = new T.Mesh(new T.CylinderGeometry(2.5, 2.5, 2.4, 48, 1, true, Math.PI * .79, Math.PI * .45), amberMaterial);
  amber.castShadow = true; amber.receiveShadow = true; set.add(amber);
  let target, loadedModel, dpr = 1, disposed = false;

  return {
    async load() {
      const gltf = await new GLTFLoader().loadAsync(new URL('./assets/shoe-beach.glb', import.meta.url).href);
      loadedModel = gltf.scene;
      const bounds = new T.Box3().setFromObject(loadedModel), center = bounds.getCenter(new T.Vector3());
      const normalize = new T.Group(); normalize.add(loadedModel); loadedModel.position.sub(center);
      normalize.scale.setScalar(3.3 / bounds.getSize(new T.Vector3()).x);
      loadedModel.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; object.material.envMapIntensity = .8; } });
      shoe.add(normalize);
      // Render the same geometry into the laptop so the emerging subject stays coherent.
      const preview = new T.Scene(); preview.environment = environment.texture; preview.environmentIntensity = 1;
      const previewShoe = normalize.clone(true); previewShoe.rotation.set(.06, -.22, -.08); preview.add(previewShoe);
      preview.add(new T.HemisphereLight('#ffffff', '#dad2c4', 2));
      const previewLight = new T.DirectionalLight('#fff3df', 3); previewLight.position.set(-3, 6, 5); preview.add(previewLight);
      const previewCamera = new T.PerspectiveCamera(32, 1.11, .1, 25); previewCamera.position.set(1.2, .8, 7.2); previewCamera.lookAt(0, 0, 0);
      target = new T.WebGLRenderTarget(mobile ? 512 : 768, mobile ? 460 : 690);
      const oldAlpha = renderer.getClearAlpha(); renderer.setClearAlpha(0); renderer.setRenderTarget(target); renderer.render(preview, previewCamera); renderer.setRenderTarget(null); renderer.setClearAlpha(oldAlpha);
      screenImage.material.map = target.texture; screenImage.material.needsUpdate = true;
    },
    resize(width, height, pixelRatio) {
      dpr = Math.min(pixelRatio, mobile ? 1.25 : 1.5); renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
    },
    render(s) {
      if (disposed) return;
      scene.background.copy(lightBackground).lerp(darkBackground, s.darkness);
      scene.fog.color.copy(scene.background); floorMaterial.color.copy(scene.background).multiplyScalar(mix(.55, .22, s.darkness));
      scene.environmentIntensity = mix(.65, .8, s.darkness);
      key.intensity = mix(3.6, 4.5, s.darkness); rim.intensity = mix(.7, 3.2, s.darkness);
      laptop.position.set(s.laptopX, s.laptopY, s.laptopZ); laptop.rotation.y = s.laptopAngle; laptop.scale.setScalar(s.laptopScale);
      hinge.rotation.x = s.lidAngle;
      shoe.visible = s.p > .205; shoe.position.set(s.shoeX, s.shoeY, s.shoeZ); shoe.rotation.set(s.shoeTilt, s.shoeAngle, -.065); shoe.scale.setScalar(s.shoeScale);
      screenImage.material.opacity = 1 - phase(s.p, .20, .25);
      for (let i = 0; i < rocks.length; i++) {
        const t = phase(s.p, .41 + i * .022, .65 + i * .018), data = rockData[i];
        rocks[i].visible = t > 0;
        rocks[i].position.set(...data.end.map((v, k) => mix(data.from[k], v, t)));
        rocks[i].rotation.set((1 - t) * (i + 1), (1 - t) * 2, (1 - t) * .5);
      }
      const archPhase = phase(s.p, .46, .73);
      arch.visible = archPhase > 0; arch.position.set(mix(5, .6, archPhase), mix(4, -.86, archPhase), -1.0); arch.rotation.set(0, mix(1.5, -.18, archPhase), mix(-1.3, 0, archPhase));
      const amberPhase = phase(s.p, .49, .72);
      amber.visible = amberPhase > 0; amber.position.set(mix(-5, .15, amberPhase), mix(3, .02, amberPhase), -.6); amber.rotation.y = mix(-1.3, -.9, amberPhase);
      camera.position.set(Math.sin(s.cameraAzimuth) * s.cameraDistance, s.cameraHeight, Math.cos(s.cameraAzimuth) * s.cameraDistance);
      camera.lookAt(mobile ? .05 : -1.3, mobile ? .45 : .1, 0);
      renderer.render(scene, camera);
    },
    stats() { return { dpr, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; },
    dispose() {
      disposed = true;
      const geometries = new Set(), materials = new Set(), textures = new Set();
      scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat); });
      for (const mat of materials) { for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value); mat.dispose(); }
      geometries.forEach(geometry => geometry.dispose()); textures.forEach(texture => texture.dispose());
      target?.dispose(); environment.dispose(); renderer.dispose();
    },
  };
}
