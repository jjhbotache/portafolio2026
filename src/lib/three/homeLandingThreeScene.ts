import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { loadLandingDisk } from './homeLandingDisk';
import { createLandingStarField, loadLandingEnvironment } from './homeLandingEnvironment';
import { createLandingTitles } from './homeLandingTitles';

export type LandingScene = {
  overlay: HTMLElement;
  diskRoot: THREE.Group;
  camera: THREE.PerspectiveCamera;
  showTitles: () => void;
  hideTitles: () => void;
};

export function resetCameraToInitialPosition(camera: THREE.PerspectiveCamera) {
  camera.position.x = -.75;
  camera.position.z = -1;
  camera.position.y = 3;
  // zoom the camera in a bit
  camera.zoom = 5;
  camera.updateProjectionMatrix();
}

const addLights = (scene: THREE.Scene, helpers = false) => {
  const keyLight = new THREE.PointLight(0x59a5ff, 80, 30);
  keyLight.position.set(1.5, 3, 2);
  scene.add(keyLight);
  if (helpers) {
    const keyLightHelper = new THREE.PointLightHelper(keyLight, 0.5);
    scene.add(keyLightHelper);
  }
  
  const directLight = new THREE.DirectionalLight(0x68d9ff, 20);
  directLight.position.set(-8, 5, 1);
  scene.add(directLight);
  if (helpers) {
    const directLightHelper = new THREE.DirectionalLightHelper(directLight, 0.5);
    scene.add(directLightHelper);
  }
  
  const directLight2 = new THREE.DirectionalLight(0x68d9ff, 30);
  directLight2.position.set(0, 15, 0);
  scene.add(directLight2);
  if (helpers) {
    const directLightHelper2 = new THREE.DirectionalLightHelper(directLight2, 0.5);
    scene.add(directLightHelper2);
  }

  const ambientLight = new THREE.AmbientLight(0x2047ff, 60);
  scene.add(ambientLight);
};

const setupIdleCameraOrbit = (controls: OrbitControls) => {
  const idleDelayMs = 5000;
  let resumeOrbitTimeoutId: number | null = null;

  controls.autoRotate = true;
  controls.autoRotateSpeed = -.2;

  const clearResumeTimeout = () => {
    if (resumeOrbitTimeoutId !== null) {
      window.clearTimeout(resumeOrbitTimeoutId);
      resumeOrbitTimeoutId = null;
    }
  };

  const pauseOrbit = () => {
    controls.autoRotate = false;
    clearResumeTimeout();
  };

  const scheduleOrbitResume = () => {
    clearResumeTimeout();
    resumeOrbitTimeoutId = window.setTimeout(() => {
      controls.autoRotate = true;
      resumeOrbitTimeoutId = null;
    }, idleDelayMs);
  };

  controls.addEventListener('start', pauseOrbit);
  controls.addEventListener('end', scheduleOrbitResume);
};

const setupResize = (
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  composer: EffectComposer,
  bloomPass: UnrealBloomPass,
) => {
  const onResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);
    bloomPass.setSize(width, height);
  };

  window.addEventListener('resize', onResize);
};

let lastFrameTime = 0;
const targetFPS = 20; // Cambia a 24, 20, etc. según lo que quieras
const frameDuration = 1000 / targetFPS;

const startRenderLoop = (
  controls: OrbitControls,
  composer: EffectComposer,
  animate?: (elapsedTime: number) => void,
) => {
  const clock = new THREE.Timer();

  // // const tick = () => {
  // //   const elapsedTime = clock.getElapsed();
  // //   animate?.(elapsedTime);
  // //   controls.update();
  // //   composer.render();
  // //   requestAnimationFrame(tick);
  // // };

  // // tick();
  
  // reduce FPS
  function tick() {
  const now = performance.now();
  if (now - lastFrameTime >= frameDuration) {
    lastFrameTime = now;
    const elapsedTime = clock.getElapsed();
    animate?.(elapsedTime);
    controls.update();
    composer.render();
  }
  requestAnimationFrame(tick);
}
tick();
};

const createGradientBackground = () => {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, '#000000');
  gradient.addColorStop(1, '#1b0041');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
};

export const createHomeLandingThreeScene = (overlay: HTMLElement | null): LandingScene | null => {
  if (!overlay) {
    return null;
  }

  const scene = new THREE.Scene();
  scene.background = createGradientBackground();
  
  // create an sphere and apply some material
  // const sphereGeometry = new THREE.SphereGeometry(5, 32, 32);
  // const sphereMesh = new THREE.Mesh(sphereGeometry, materialFactory('floorDark'));
  // scene.add(sphereMesh);

  // add the axis helper to the scene
  const axesHelper = new THREE.AxesHelper(5);
  // scene.add(axesHelper);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  resetCameraToInitialPosition(camera);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  overlay.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.015,
    0.1,
    .4,
  );
  composer.addPass(bloomPass);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 0;
  controls.maxDistance = 30;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.target.set(0, 0, 0);
  setupIdleCameraOrbit(controls);
  // controls.enablePan = false;
  // controls.enableZoom = false;

  const diskRoot = new THREE.Group();
  diskRoot.scale.set(0.03, 0.03, 0.03);
  // rotate the disk to be horizontal
  diskRoot.rotation.set(THREE.MathUtils.degToRad(90), 0, 0);
  scene.add(diskRoot);

  loadLandingDisk(diskRoot);
  loadLandingEnvironment(scene);

  const { starField, animate } = createLandingStarField();
  scene.add(starField);

  const titles = createLandingTitles(scene, camera);

  addLights(scene);
  setupResize(camera, renderer, composer, bloomPass);
  startRenderLoop(controls, composer, (elapsedTime) => {
    animate(elapsedTime);
    titles.updateFromCamera(elapsedTime);
  });

  const onPageHide = () => {
    titles.dispose();
  };

  window.addEventListener('pagehide', onPageHide, { once: true });

  return {
    overlay,
    diskRoot,
    camera,
    showTitles: titles.show,
    hideTitles: titles.hide,
  };
};
