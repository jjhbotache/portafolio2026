import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { loadLandingDisk, disposeLandingDisk } from './homeLandingDisk';
import { createLandingStarField, disposeLandingEnvironment } from './homeLandingEnvironment';
import { createLandingTitles } from './homeLandingTitles';
import { configureMaterialAnisotropy, disposeAllTextures } from './materialFactory';
import type { SectionConfig } from '../sections';
import type { Lang } from '../../i18n/utils';
import gsap from 'gsap';

const bloomResolutionScale = 1/8;
// const pixelRatio = .5;
const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
export const DETAIL_VIEW_PIXEL_RATIO = 0.2;
// 30 FPS is a much better target than the previous 14: the post-process
// chain (RenderPass + UnrealBloom) is cheap on modern GPUs and the
// scrub-driven landing timeline already animates at ~60 FPS on its own.
// Going from 14 -> 30 halves the perceived lag of the camera flythrough
// and the title cross-fade without measurably hurting battery on
// mid-range laptops. Devices on the low GPU tier still benefit from the
// adaptive frame budget below.
const FPS = 30;
const deactivateBloom = false;

const bloomResolution = {
  width: window.innerWidth * bloomResolutionScale,
  height: window.innerHeight * bloomResolutionScale
};

export type LandingScene = {
  overlay: HTMLElement;
  diskRoot: THREE.Group;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  scene: THREE.Scene;
  showTitles: () => void;
  hideTitles: () => void;
  titlesAreVisible: () => boolean;
  titles: ReturnType<typeof createLandingTitles>;
  pauseOrbit: () => void;
  scheduleOrbitResume: () => void;
  setAutoRotateSuppressed: (suppressed: boolean) => void;
  getActiveSectionIndex: () => number;
  getActiveSection: () => SectionConfig | undefined;
  setPixelRatio: (ratio: number) => void;
  getPixelRatio: () => number;
  navigateToSection: (index: number) => Promise<void>;
  dispose: () => void;
};

export function resetCameraToInitialPosition(camera: THREE.PerspectiveCamera, isMobile = false) {
  camera.position.x = -.75;
  camera.position.z = -1;
  // On mobile, position the camera higher and farther for a wider view
  camera.position.y = isMobile ? 5 : 3;
  // On mobile, zoom out more (lower zoom value = wider view)
  camera.zoom = isMobile ? 3 : 5;
  camera.updateProjectionMatrix();
}

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const addLights = (scene: THREE.Scene, helpers = false) => {
  // const keyLight = new THREE.PointLight(0x59a5ff, 80, 30);
  // keyLight.position.set(1.5, 3, 2);
  // scene.add(keyLight);
  // if (helpers) {
  //   const keyLightHelper = new THREE.PointLightHelper(keyLight, 0.5);
  //   scene.add(keyLightHelper);
  // }
  
  const directLight = new THREE.DirectionalLight(0x68d9ff, 20);
  directLight.position.set(-8, 5, 1);
  scene.add(directLight);
  if (helpers) {
    scene.add(new THREE.DirectionalLightHelper(directLight, 0.5));
  }
  
 
  
  const directLight2 = new THREE.DirectionalLight(0x68d9ff, 30);
  directLight2.position.set(0, 15, 0);
  scene.add(directLight2);
  if (helpers) {
    scene.add(new THREE.DirectionalLightHelper(directLight2, 0.5));
  }

  const ambientLight = new THREE.AmbientLight(0x2047ff, 60);
  scene.add(ambientLight);
};

const setupIdleCameraOrbit = (controls: OrbitControls) => {
  const idleDelayMs = 5000;
  let resumeOrbitTimeoutId: number | null = null;
  // When true, scheduleOrbitResume becomes a no-op and any pending resume
  // timeout is cancelled. Used by the detail view to keep auto-rotation off
  // even after the user has been idle for longer than `idleDelayMs`.
  let suppressed = false;

  controls.autoRotate = !prefersReducedMotion();
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
    // Detail view is open: do not arm the resume timer. The orchestrator
    // will re-enable scheduling once the view is closed.
    if (suppressed) return;
    clearResumeTimeout();
    if (prefersReducedMotion()) {
      return;
    }
    resumeOrbitTimeoutId = window.setTimeout(() => {
      controls.autoRotate = true;
      resumeOrbitTimeoutId = null;
    }, idleDelayMs);
  };

  const setSuppressed = (value: boolean) => {
    suppressed = value;
    if (value) {
      // Force the orbit off and drop any in-flight resume timeout so the
      // detail view stays still even if the user is idle for the full
      // `idleDelayMs` window.
      controls.autoRotate = false;
      clearResumeTimeout();
    }
  };

  controls.addEventListener('start', pauseOrbit);
  controls.addEventListener('end', scheduleOrbitResume);
  return { pauseOrbit, scheduleOrbitResume, setSuppressed };
};

const setupResize = (
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  composer: EffectComposer,
  bloomPass: UnrealBloomPass,
  getCurrentPixelRatio: () => number,
) => {
  const onResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio, getCurrentPixelRatio());

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
    bloomPass.setSize(bloomResolution.width, bloomResolution.height);
  };

  window.addEventListener('resize', onResize);
  return onResize;
};

// Adaptive frame throttling: start at 30 FPS floor, raise to 60 FPS in
// small +2 steps if the device has headroom. A bigger step causes the loop
// to skip over the 45-55 FPS zone on mid-range hardware, leaving the user
// with an unnecessarily choppy experience.

const FRAME_BUDGET = 1000 / FPS;
let lastFrameTime = 0;

const startRenderLoop = (
  controls: OrbitControls,
  composer: EffectComposer,
  onResizeRef: { current: (() => void) | null },
  animate?: (elapsedTime: number) => void,
) => {
  // Connect timer to document so it pauses when the tab is hidden.
  const clock = new THREE.Timer();
  clock.connect(document);

  let isVisible = !document.hidden;
  // `running` is flipped to `false` by `stopRenderLoop`. Without this flag
  // the rAF loop keeps scheduling itself forever even after the scene is
  // disposed — that's the bug that left a GPU-bound tick per re-init
  // (every SPA navigation added another 14 FPS render loop that never died).
  let running = true;

  const handleVisibilityChange = () => {
    isVisible = !document.hidden;
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const tick = () => {
    if (!running) {
      return;
    }
    if (!isVisible) {
      requestAnimationFrame(tick);
      return;
    }

    const now = performance.now();
    if (now - lastFrameTime >= FRAME_BUDGET) {
      lastFrameTime = now;
      const elapsedTime = clock.getElapsed();
      animate?.(elapsedTime);

      // Only call controls.update when damping/autoRotate are active to skip
      // unnecessary work in static views.
      if (controls.enableDamping || controls.autoRotate) {
        controls.update();
      }
      composer.render();
    }
    requestAnimationFrame(tick);
  };
  tick();

  const stopRenderLoop = () => {
    running = false;
  };

  return {
    handleVisibilityChange,
    stopRenderLoop,
  };
};

const createGradientBackground = (): THREE.Texture | null => {
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

export const createHomeLandingThreeScene = (
  overlay: HTMLElement | null,
  lang: Lang = 'en',
): LandingScene | null => {
  if (!overlay) {
    return null;
  }
  
  const scene = new THREE.Scene();
  const backgroundTexture = createGradientBackground();
  if (backgroundTexture) {
    scene.background = backgroundTexture;
  }

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  resetCameraToInitialPosition(camera);

  // alpha: false because the background is opaque, saving a composite per frame.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  configureMaterialAnisotropy(renderer);
  overlay.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(bloomResolution.width, bloomResolution.height),
    0.015,
    0.1,
    0.4,
  );
  if (deactivateBloom) {
    bloomPass.enabled = false;
  }
  composer.addPass(bloomPass);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 0;
  controls.maxDistance = 30;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.target.set(0, 0, 0);
  const { pauseOrbit, scheduleOrbitResume, setSuppressed: setAutoRotateSuppressed } = setupIdleCameraOrbit(controls);

  const diskRoot = new THREE.Group();
  diskRoot.scale.set(0.03, 0.03, 0.03);
  diskRoot.rotation.set(THREE.MathUtils.degToRad(90), 0, 0);
  scene.add(diskRoot);

  loadLandingDisk(diskRoot);
  // Note: loadLandingEnvironment is invoked from buildLandingTimeline so the
  // STL preloads can be kicked off the moment the landing timeline starts.

  const { starField, animate, dispose: disposeStarField } = createLandingStarField();
  scene.add(starField);

  const titles = createLandingTitles(scene, camera, lang);

  addLights(scene);
  const onResizeRef: { current: (() => void) | null } = { current: null };

  // Mutable pixel ratio used by both the resize handler and the explicit
  // setPixelRatio API. The detail view drops it temporarily to relieve GPU
  // load, then restores the default.
  let currentPixelRatio = pixelRatio;

  const applyPixelRatioNow = () => {
    const dpr = Math.min(window.devicePixelRatio, currentPixelRatio);
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
  };

  const setPixelRatio = (ratio: number) => {
    if (ratio === currentPixelRatio) return;
    currentPixelRatio = ratio;
    applyPixelRatioNow();
  };

  const getPixelRatio = () => currentPixelRatio;


  const MAX_YAW_DEG = 10;
  const MIN_YAW_DEG = 5;
  const GROWTH = 1.1;
  const TICK_DURATION = 0.2;
  const yawRadians = (deg: number) => (deg * Math.PI) / 180;

  const nameList = ['experienceBackground','projectsBackground',  'contactBackground','aboutMeBackground',];
  
  const navigateToSection = (index: number): Promise<void> => {
    const sectionToArrive = nameList[index];  
    const arrivedToSection = () => (titles.getActiveTitleGroup().children[0].name === sectionToArrive);
    console.log("going to",sectionToArrive);
    
    
    return new Promise<void>((completeNavigation) => {
      const anglePerTitle = titles.anglePerTitle;
      const sectionCount = titles.sectionCount;
      if (
        typeof anglePerTitle !== 'number' ||
        typeof sectionCount !== 'number' ||
        typeof titles.getRelativeAngle !== 'function' ||
        index < 0 ||
        index >= sectionCount  ||
        arrivedToSection()
      ) {
        completeNavigation();
        return;
      }

      // Stop the idle auto-rotation so it doesn't fight the navigation.
      pauseOrbit();

      // The yaw direction is decided once up front and stays constant
      // for the whole navigation: clockwise (negative yaw in our world
      // space, since `getCameraClockwiseAngle` rises as the camera
      // swings clockwise around the disk).
      const clockwise = true;

      let yawDeg = MIN_YAW_DEG;
      let cancelled = false;

      const setCameraYaw = (delta: number) => {
        const diskCenter = titles.getTitlesWorldPosition();
        const radius = camera.position.clone().sub(diskCenter);
        const radiusLen = Math.hypot(radius.x, radius.z);
        const yaw = -titles.getCameraClockwiseAngle();
        const nextYaw = yaw + delta;
        camera.position.set(
          Math.sin(nextYaw) * radiusLen + diskCenter.x,
          radius.y + diskCenter.y,
          Math.cos(nextYaw) * radiusLen + diskCenter.z,
        );
      };

      const tick = () => {
        
        if (cancelled) return;
        const deltaYaw = yawRadians(yawDeg) * (clockwise ? 1 : -1);
        gsap.to(
          { t: 0 },
          {
            t: 1,
            duration: TICK_DURATION,
            ease: 'linear',
            onUpdate: function tweenUpdate() {
              const raw = this.targets()[0] as { t: number };
              const eased = raw.t;
              setCameraYaw(deltaYaw * eased);
            },
            onComplete: () => {
              // console.log(titles.getActiveTitleGroup().children[0].name);
              setCameraYaw(deltaYaw);
              yawDeg = Math.min(yawDeg * GROWTH, MAX_YAW_DEG);
              
              if(!arrivedToSection()) {
                tick();
              } else {
                setTimeout(completeNavigation, 200);
                ;
              }
            },
          },
        );
      };

      tick()
    });
  };

  onResizeRef.current = setupResize(camera, renderer, composer, bloomPass, getPixelRatio);

  const { handleVisibilityChange, stopRenderLoop } = startRenderLoop(controls, composer, onResizeRef, (elapsedTime) => {
    animate(elapsedTime);
    // Titles' `updateFromCamera` does matrix / slerp work and triggers a
    // backdrop `update`, none of which needs to run while titles are hidden
    // (intro animation, scrolled back up, ...). Gate it on the visibility
    // flag owned by the titles module.
    if (titles.areTitlesVisible()) {
      titles.updateFromCamera(elapsedTime);
    }
  });

  // Dispose all GPU/CPU resources owned by the landing scene.
  // Triggered on pagehide and exposed via the returned `dispose` method for
  // client-side navigation scenarios.
  const cleanupFns: Array<() => void> = [
    () => titles.dispose(),
    () => disposeLandingDisk(),
    () => disposeLandingEnvironment(),
    () => disposeStarField(),
    () => controls.dispose(),
    () => composer.dispose(),
    () => bloomPass.dispose(),
    () => renderer.dispose(),
    () => backgroundTexture?.dispose(),
    () => disposeAllTextures(),
  ];

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    // Stop the rAF tick BEFORE disposing the composer/renderer, otherwise
    // the loop would call into a disposed EffectComposer for one more
    // frame and could throw.
    stopRenderLoop();
    cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.warn('Landing scene cleanup error:', err);
      }
    });
    if (onResizeRef.current) {
      window.removeEventListener('resize', onResizeRef.current);
      onResizeRef.current = null;
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  };

  window.addEventListener('pagehide', dispose, { once: true });

  return {
    overlay,
    diskRoot,
    camera,
    controls,
    scene,
    titles,
    showTitles: titles.show,
    hideTitles: titles.hide,
    titlesAreVisible: titles.areTitlesVisible,
    pauseOrbit,
    scheduleOrbitResume,
    setAutoRotateSuppressed,
    getActiveSectionIndex: titles.getActiveSectionIndex,
    getActiveSection: titles.getActiveSection,
    setPixelRatio,
    getPixelRatio,
    navigateToSection,
    dispose,
  };
};

