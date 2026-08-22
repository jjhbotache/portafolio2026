import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createHomeLandingThreeScene, resetCameraToInitialPosition, DETAIL_VIEW_PIXEL_RATIO, type LandingScene } from './three/homeLandingThreeScene';
import { texturesReady } from './three/materialFactory';
import { CatmullRomCurve3, MathUtils, Vector3, Camera, Group } from 'three';
import { fadeOutDisk, fadeInDisk, preloadLandingDisk } from './three/homeLandingDisk';
import { preloadLandingModels } from './three/homeLandingTitles';
import { fadeOutFloor, fadeInFloor, preloadLandingEnvironment, loadLandingEnvironment } from './three/homeLandingEnvironment';
import { sections } from './sections';
import { detectGpuCapabilities  } from './gpuCapabilities';
import * as THREE from 'three';
import type { Lang } from '../i18n/utils';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { getLangFromUrl, t } from '../i18n/utils';

const cameraTargetYPosition = 1.5;

// Duration of the `#detail-overlay` opacity fade. Matches the
// `transition-opacity duration-300` Tailwind utility on the wrapper. JS
// needs to know this constant to flip `display: none` after the fade
// completes so the overlay collapses back without blocking pointer events.
const DETAIL_OVERLAY_FADE_MS = 300;

// Detect GPU capability once per page load. The score decides between
  // the heavy (masked + pinned) entrance timeline and a lightweight
  // alternative that skips the mask and the ScrollTrigger scrub.
  const gpu = detectGpuCapabilities();
  console.info('[GPU]', {
    tier: gpu.tier,
    score: gpu.score,
    renderer: gpu.signals.renderer,
  });

// Hooks exposed by each section's <script> block. The scene orchestrator
// calls them when a section is opened/closed so the section can run any
// entry animation (typing, marquee, ScrollTrigger refresh, etc.).
type SectionHooks = {
  start?: () => void;
  stop?: () => void;
};
const getSectionHooks = (sectionId: string): SectionHooks => {
  const w = window as unknown as Record<string, SectionHooks | undefined>;
  const key = sectionId === 'experience'
    ? '__experienceHooks'
    : sectionId === 'projects'
      ? '__projectsHooks'
      : sectionId === 'aboutMe'
        ? '__aboutMeHooks'
        : sectionId === 'contact'
          ? '__contactHooks'
          : null;
  if (!key) return {};
  return w[key] ?? {};
};

// Tracks whether the space intro camera flythrough is currently playing.
// While it is true, the detail view cannot be opened from the overlay
// (the titles are hidden anyway, but we also block clicks and hover).
let isSpaceIntroPlaying = false;

// Cleanup functions registered by `buildLightweightIntro` (wheel/touchmove/
// keydown listeners + GSAP tweens). They run on SPA re-init and on
// `pagehide` so we never accumulate stale handlers when the user navigates
// away and back via ClientRouter.
const lightCleanupFns: Array<() => void> = [];
let lightPagehideRegistered = false;

// Wait until the hero portrait decodes. Wrapped in a Promise so it
// composes with the `Promise.all` inside `buildLandingTimeline`. We use
// `img.decode()` when available (it resolves only when the raster is
// ready to paint, which is what we actually care about) and fall back to
// the `complete + onload` pair for older browsers.
const waitForHeroImage = (): Promise<void> => {
  const img = document.querySelector<HTMLImageElement>('#hero-me');
  if (!img) return Promise.resolve();
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  if (typeof img.decode === 'function') {
    return img.decode().catch(() => undefined);
  }
  return new Promise<void>((resolve) => {
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  });
};

const scrollerPos =  400;
gsap.registerPlugin(ScrollTrigger);
const buildLandingTimeline = async (
  heroMask: Element,
  contentEl: Element | null,
  landingScene: LandingScene | null,
  onReset?: () => void,
) => {
  let spaceIntroPlayed = false;

  // Freeze body scroll until every asset the landing depends on has
  // loaded: platform/floor STLs, disk + title + backdrop geometry, the
  // five PBR textures, the custom font-faces, and the hero portrait.
  // Without this the user can scroll and trigger the space intro while
  // backdrops are still invisible (cold cache, ~30 MB of STLs to fetch),
  // producing a half-empty scene for the first second of the flythrough.
  // We save the previous overflow value (the detail view also toggles it)
  // and restore it in `finally` so a thrown await can't strand the page
  // in a frozen scroll state.
  const previousBodyOverflowY = document.body.style.overflowY;
  document.body.style.overflowY = 'hidden';

  try {
    // Wait for the STL fetches kicked off by `preloadLandingEnvironment` to
    // settle before consuming them in `loadLandingEnvironment`. Both calls hit
    // the shared `stlGeometryCache`, so the second call is effectively free.
    await preloadLandingEnvironment();
    if (landingScene) {
      loadLandingEnvironment(landingScene.scene);
    }

    // Block on the PBR textures. The shared `LoadingManager` resolves
    // `texturesReady` once every color / displacement / metalness / normal
    // / roughness map is decoded, or logs a warning and resolves anyway
    // on error so a single broken texture never strands the page.
    await texturesReady;

    // Block on the custom font-faces declared in `global.css`
    // (`Tron`, `8bit`, `PixeloidSans`). `document.fonts.ready` resolves
    // when every @font-face has either finished loading or failed, so a
    // broken font won't deadlock the page. Same pattern as
    // `ExperienceDetail.astro`.
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.ready;
    }

    // Block on the hero portrait decode so the first time the page
    // becomes interactive the portrait is in place.
    await waitForHeroImage();

    // Reveal the scroll-down arrow now that everything is ready and the
    // user is about to be allowed to scroll. The element starts at
    // `opacity-0` in CSS; the `transition-all duration-500` utility on it
    // drives the fade-in once this class swap lands. Used as the visual
    // signal that scrolling is unlocked.
    const landingArrow = document.querySelector<HTMLElement>('#landing-arrow');
    if (landingArrow) {
      landingArrow.classList.add('opacity-100');
    }

    // Dismiss the "Cargando..." indicator that was pulsing above the
    // arrow. We strip `animate-pulse` *before* the opacity fade-out so it
    // doesn't keep blinking while it dissolves, then apply the same
    // `opacity-0` swap used elsewhere so the same `transition-all
    // duration-500` utility drives the fade.
    const landingLoading = document.querySelector<HTMLElement>('#landing-loading');
    if (landingLoading) {
      landingLoading.classList.remove('animate-pulse');
      landingLoading.classList.add('opacity-0');
      // Remove from the layout after the fade so screen-readers and
      // tab-order skip it. `transitionend` is more robust than a fixed
      // timeout (covers `prefers-reduced-motion` disables cleanly).
      const onTransitionEnd = () => {
        landingLoading.classList.add('hidden');
        landingLoading.removeEventListener('transitionend', onTransitionEnd);
      };
      landingLoading.addEventListener('transitionend', onTransitionEnd, { once: true });
    }
  } finally {
    document.body.style.overflowY = previousBodyOverflowY;
  }
  
  // executed when the user scrolls back up
  function reset3D () {
    if (!landingScene) return;
    // also close the detail view (if it is open) so we never leave it dangling
    // after the user scrolls back up out of the 3D scene
    onReset?.();
    // Hide titles and reset overlay visibility *instantly* (no tween).
    // Previously we ran a 0.2s gsap.to(...) on the overlay while titles were
    // still being drawn by the render loop, which produced a brief flash of
    // the previous section's title before the fade-out completed.
    landingScene.hideTitles();
    gsap.set(landingScene.overlay, { autoAlpha: 0, pointerEvents: 'none' });
    resetCameraToInitialPosition(landingScene.camera, gpu.isMobile);
    spaceIntroPlayed = false;
  };
  // executed when the user scrolls down and reaches some percentage of the scroll
  function triggerSpaceIntroAnimation() {
        spaceIntroPlayed = true;
        landingScene && SpaceIntroAnimation3D(landingScene);
  }


  // gsap.set(landingScene?.overlay, { autoAlpha: 1, pointerEvents: 'none' });
  
  
  
  const tl = gsap.timeline({
  scrollTrigger: {
    trigger: heroMask,
    start: 'top top',
    end: '+=' + scrollerPos,
    scrub: 0.1,
    pin: true,
    onEnterBack: reset3D,
    
  },
});

  // Mask shrink — unchanged. The mask is what we are explicitly NOT touching.
  tl.to(heroMask, {
    webkitMaskSize: '5%',
    maskSize: '5%',
    ease: 'sine.in',
    duration: 1,
    onComplete: () => {
      !spaceIntroPlayed && triggerSpaceIntroAnimation();
    },
  });
  
  tl.to(heroMask, {
    opacity: 0,
    ease: 'sine.in',
    duration: 1,
  },0.2);

  // Content scale — unchanged. `transform: scale()` is GPU-composited and
  // already cheap on every frame.
  tl.to(contentEl, {
    scale: 1,
    ease: 'power2.in',
    duration: 0.5    
  }, '<');

  // Mask position — unchanged.
  tl.to(heroMask, {
    '--mask-pos': '50% 50%',
    ease: 'sine.in',
    duration: 0.4,
    onComplete: () => {
      !spaceIntroPlayed && triggerSpaceIntroAnimation();
    },
  }, 0.6);


  tl.fromTo(
    contentEl,
    { opacity: 1 },
    { opacity: 0, duration: 0.2, ease: 'power2.out' },
    0.4
  );

  tl.to(heroMask, {
    '--hero-before-opacity': 1,
    ease: 'sine.out',
    duration: 0.5,
  }, 0.2);


};


function startTutorialIfNeeded(overlay: HTMLElement | null,forceShow: boolean = false) {
  if (!overlay) return;

  try {
    const key = 'landing_tutorial_shown_count';
    const shownCount = Number(localStorage.getItem(key) ?? 0);
    if (!isNaN(shownCount) && shownCount >= 2 && !forceShow) return;

    const tutorialOverlay = overlay.querySelector('#tutorial-overlay') as HTMLElement | null;
    // NOTE: `#tutorial-icon` is queried but no element with that id is
    // rendered in the page template — the actual cursor icon is
    // `#cursor-icon-tutorial` (which has its own CSS keyframe animation
    // defined in `[lang]/index.astro`). As a result the GSAP bobby-trapped
    // loop below is currently dead code; the guard returns before any
    // tween runs. If a `#tutorial-icon` element is added later the
    // timeline will spring back to life without changes.
    const tutorialIcon = overlay.querySelector('#tutorial-icon') as HTMLElement | null;
    if (!tutorialOverlay || !tutorialIcon) return;

    // mark as shown (increment once per start)
    const newCount = Math.min(2, (isNaN(shownCount) ? 0 : shownCount) + 1);
    localStorage.setItem(key, String(newCount));

    // reveal
    tutorialOverlay.classList.add('visible');
    tutorialOverlay.classList.remove('hidden');
    gsap.set(tutorialIcon, {y: "-25vh", x: "30vw", scale: 2, opacity: 0, transformOrigin: '50% 50%' });

    const tl = gsap.timeline({ repeat: -1 });
    
    tl
      .to(tutorialIcon, { scale: 1, opacity: 1, duration: 0.6, ease: 'power1.out' })
      .to(tutorialIcon, { x: '-30vw', duration: 3.0, ease: 'power2.out' })
      .to(tutorialIcon, { x: 0, scale: 2, opacity: 0, duration: 0 });

    let timeoutId: number | null = window.setTimeout(() => stop(), 10000);

    function stop() {
      tl.kill();
      tutorialOverlay?.classList.remove('visible');
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      overlay?.removeEventListener('pointerdown', onPointerDown);
    }

    function onPointerDown(event: PointerEvent) {
      stop();
      // Forward the pointerdown to the canvas so OrbitControls starts the drag
      // on the same click that dismissed the tutorial. Without this the user
      // has to click twice: first to hide the tutorial, then again to grab the
      // scene, because the tutorial overlay is on top of the canvas and
      // captures the original pointerdown.
      const canvas = overlay?.querySelector('canvas');
      if (canvas) {
        const forwarded = new PointerEvent('pointerdown', {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          button: event.button,
          buttons: event.buttons,
          isPrimary: event.isPrimary,
          pointerType: event.pointerType,
          bubbles: true,
          cancelable: true,
        });
        canvas.dispatchEvent(forwarded);
      }
    }

    overlay.addEventListener('pointerdown', onPointerDown);
  } catch (e) {
    // ignore storage errors
    // console.warn('tutorial init failed', e);
  }
}

function startDriver(lang: Lang) {
  // mesure the time from start to end of the tutorial, if it is less than 2 seconds, we don't count it as a completed tutorial
  let startTime: number | null = null;
  let endTime: number | null = null;
  
  // show
  document.querySelector("#tutorial-overlay")?.classList.remove("hidden");
  
  // deactivate the page scroll until the tutorial is finished or canceled
  document.body.style.overflowY = 'hidden';
  
  
  
  //  return if the tutorial has already been started more than x times (stored in localStorage)    
  if (
    typeof window !== 'undefined' &&
    window.localStorage &&
    (isNaN(Number(window.localStorage.getItem('driverStarted')!)) || Number(window.localStorage.getItem('driverStarted')!) > 2)
  ) {
    document.querySelector("#tutorial-overlay")?.classList.add("hidden");
    return;
  }

  const driverObj = driver({
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: t(lang, 'tutorial.next'),
    prevBtnText: t(lang, 'tutorial.prev'),
    doneBtnText: t(lang, 'tutorial.done'),
    onDoneClick : () => {
      // ended
      const endTime = Date.now();
      const startTime = null;
      const elapsedTime = endTime && startTime ? endTime - startTime : null;
      if ((elapsedTime && elapsedTime > 4000) || driverObj.isLastStep()) {
        window.localStorage.setItem('driverStarted', String(Number(window.localStorage.getItem('driverStarted') || 0) + 1));
      }
      
      driverObj.destroy();
    },
    onDestroyed: () => { // when ended/canceled
      document.body.style.overflowY = 'auto';
      document.querySelector("#cursor-icon-tutorial")?.classList.add("hidden");
      document.querySelector("#tutorial-overlay")?.classList.add("hidden");
    },
    onNextClick: (element,step) => {
      // console.log(element,step);
      
      if(step.element==="#driverjs-tutorial") document.querySelector("#cursor-icon-tutorial")?.classList.remove("hidden");
      
      driverObj.moveNext();
    },
    steps: [
      { element: '#driverjs-tutorial', popover: { title: t(lang,'tutorial.title1'), description: t(lang,'tutorial.body1') },advanceOnClick: true, },
      { element: '#tutorial-overlay', popover: { title: t(lang,'tutorial.title2'), description: t(lang,'tutorial.body2') },advanceOnClick: true, },
    ]
  });

  startTime = Date.now();
  driverObj.drive();
}

function SpaceIntroAnimation3D(landingScene: LandingScene) {
  // reveal skip text (it's inside the tutorial overlay)
  document.querySelector("#skip-tutorial")?.classList.remove("hidden");
  
  if (!landingScene) {
    return;
  }
  
  const tl = gsap.timeline({
    defaults: {
      ease: 'none',
    },
    onStart: () => {
      // Lock detail-view opening while the intro flythrough is running.
      isSpaceIntroPlaying = true;
      landingScene.hideTitles();
    },
    onComplete: () => {
      isSpaceIntroPlaying = false;
      landingScene.showTitles();
      startDriver(getLangFromUrl(new URL(window.location.href)));
      
      startTutorialIfNeeded(landingScene.overlay);
      document.removeEventListener('click', skipAnimation);
      window.scrollTo(0, scrollerPos);
      
      document.querySelector("#skip-tutorial")?.classList.add("hidden");

      // Signal the menu popup that the space flythrough is done so it
      // can play its first-time icon-morph intro. We dispatch both a
      // CustomEvent (caught by the live listener) and a window flag
      // (caught by the script if it mounted after this fired) so the
      // timing race between scene init and Astro hydration can't drop
      // the signal.
      window.dispatchEvent(new CustomEvent('portfolio:menu-intro-ready'));
      (window as unknown as { __menuIntroPending?: boolean }).__menuIntroPending = true;
      
    },
  });

  const skipAnimation = () => {
    tl.progress(1);
  };
  document.addEventListener('click', skipAnimation);

  // On mobile, use wider camera positions (farther from center) and set last anchor y to 7
  const isMobile = gpu.isMobile;
  const cameraPathAnchors = isMobile
    ? [
        new Vector3(landingScene.camera.position.x, landingScene.camera.position.y, landingScene.camera.position.z),
        new Vector3(0, 10, 4),
        new Vector3(-5, 8, 0),
        new Vector3(-5, 3, 6),
        
      ]
    : [
        new Vector3(landingScene.camera.position.x, landingScene.camera.position.y, landingScene.camera.position.z),
        new Vector3(0, 8, 2),
        new Vector3(-4, 6, 4),
        new Vector3(-4, 3, 0),
      ];

  const cameraPathCurve = new CatmullRomCurve3(cameraPathAnchors, false, 'catmullrom', 0.6);

  const totalPathDistance = cameraPathAnchors
    .slice(1)
    .reduce((distance, point, index) => distance + point.distanceTo(cameraPathAnchors[index]), 0);

  // 30-50 keyframes is the sweet spot for a ~3-unit camera flythrough:
  // any denser and the tween scheduling dominates the wall time without
  // producing visible motion improvement. The previous `*8` clamp at
  // [40, 140] was effectively always pinning at 140.
  const samplesCount = MathUtils.clamp(Math.round(totalPathDistance * 4), 30, 50);
  const sampledPoints = cameraPathCurve.getPoints(samplesCount);
  const moveDuration = 2;
  const stepDuration = moveDuration / samplesCount;

  const cameraKeyframes = sampledPoints.slice(1).map((point) => ({
    x: point.x,
    y: point.y,
    z: point.z,
    duration: stepDuration,
    ease: 'none',
  }));

  tl.to(landingScene.overlay, {
    autoAlpha: 1,
    pointerEvents: 'auto',
    duration: 0.2,
    ease: 'none',
  });
  tl.to(landingScene.camera, {
    zoom: .5,
    duration: 2,
    ease: 'sine.out',
    onUpdate: () => {
      landingScene.camera.updateProjectionMatrix();
    },
  }, '<');
  tl.to(landingScene.camera.position, {
    keyframes: cameraKeyframes,
  },'-=.3' );
  
  tl.fromTo(landingScene.controls.target,
    { x: 0, y: 0, z: 0, },
    { x: 0, y: cameraTargetYPosition, z: 0,
    duration: 2,
    ease: 'sine.out',
  }, '<');
}

function setupDetailViewToggle(landingScene: LandingScene, overlay: HTMLElement) {
  let isDetailView = false;
  const detailOverlay = document.querySelector('#detail-overlay') as HTMLElement;
  let firstThinkingManRotationY: number = 0;
  // Pixel ratio captured when the detail view opens, so we can restore the
  // previous value when it closes (preserves whatever the scene was using
  // before — default cap or any other override).
  let detailViewSavedPixelRatio: number | null = null;
  
  if (!detailOverlay) return;

  // Show only the detail view matching the active section, hide the rest.
  // Driven by the centralized `sections` config (each section declares its
  // own `htmlDetailViewSelector`).
  const showActiveDetailView = (activeSelector: string) => {
    sections.forEach((section) => {
      const el = document.querySelector<HTMLElement>(section.htmlDetailViewSelector);
      if (!el) return;
      el.classList.toggle('hidden', section.htmlDetailViewSelector !== activeSelector);
    });
  };

  const hideAllDetailViews = () => {
    sections.forEach((section) => {
      const el = document.querySelector<HTMLElement>(section.htmlDetailViewSelector);
      if (!el) return;
      el.classList.add('hidden');
    });
  };

  // floor and disk fades are handled by their modules

  // the click could come from the detail overlay or from the canvas overlay
  // Luz direccional para la detail view
  let detailViewLight: THREE.DirectionalLight | null = null;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const updateMouseCoords = (event: MouseEvent) => {
    const rect = overlay.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  // rAF-coalesced mousemove handling: store the latest event and let the
  // next animation frame consume it. Keeps the cost to one raycast per
  // frame even when the browser fires dozens of `mousemove` events.
  let pendingMouseEvent: MouseEvent | null = null;
  let mouseRafScheduled = false;

  const processMouseMove = () => {
    mouseRafScheduled = false;
    const event = pendingMouseEvent;
    pendingMouseEvent = null;
    if (!event) return;
    if (isDetailView || isSpaceIntroPlaying) {
      overlay.style.cursor = 'default';
      return;
    }
    updateMouseCoords(event);

    raycaster.setFromCamera(mouse, landingScene.camera);
    const objsToBeIntersected = raycaster.intersectObjects(
      [
        landingScene.titles.getActiveTitleGroup(),
        landingScene.titles.getActiveBackdropGroup(),
      ].filter(Boolean) as THREE.Object3D[],
      true,
    );

    if (objsToBeIntersected.length > 0) {
      overlay.style.cursor = 'pointer';
      // dim the opacity of the title and backdrop when hovered
      landingScene.titles.getActiveBackdropGroup()?.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          gsap.to(child.material, { opacity: 0.5, duration: 0.2, ease: 'sine.inOut' })
          }
      });
      
    } else {
      overlay.style.cursor = 'default';
    }
  };

  overlay.addEventListener('mousemove', (event) => {
    if (isDetailView) return;
    // Skip hover/raycast work while the intro animation is playing so we
    // don't flash a pointer cursor on top of the flythrough. Cheap shortcut:
    // bail out without setting any state and without scheduling work.
    if (isSpaceIntroPlaying) {
      overlay.style.cursor = 'default';
      return;
    }
    pendingMouseEvent = event;
    if (mouseRafScheduled) return;
    mouseRafScheduled = true;
    requestAnimationFrame(processMouseMove);
  });

  const handleToggle = (action: "open" | "close") => {
    isDetailView = action === "open";
    overlay.style.cursor = 'default';
    
    

    const activeBackdropGroup  = landingScene.titles.getActiveBackdropGroup();

    if (isDetailView) {
      // open the detail view
      // hide the overflow of the html body
      document.body.style.overflowY = 'hidden';
      
      
      
      // Agregar luz direccional en la posición de la cámara
      detailViewLight = new THREE.DirectionalLight(0x68d9ff, 40);
      detailViewLight.position.copy(landingScene.camera.position);
      landingScene.scene.add(detailViewLight);
      // ENTER DETAIL VIEW
      // pause the idle orbit behavior using the scene helper
      landingScene.pauseOrbit();
      // Block the idle resume timer for as long as the detail view is open,
      // so auto-rotation stays off even if the user idles past the delay.
      landingScene.setAutoRotateSuppressed(true);
      
      landingScene.controls.enabled = false;
      landingScene.titles.setPaused(true);
      landingScene.controls.dampingFactor = 0.002;

      const tl = gsap.timeline({
        onComplete: () => {
          if (detailViewSavedPixelRatio === null) {
            detailViewSavedPixelRatio = landingScene.getPixelRatio();
            landingScene.setPixelRatio(DETAIL_VIEW_PIXEL_RATIO);
          }
        }
      });
      // reset the camera target to keep models well framed 
      tl.to(landingScene.controls.target, { x: 0, y: 0, z: 0, duration: 0.3, ease: 'power3.inOut' }, 0);

      // Fade out background environment (use module helpers)
      const floorTween = fadeOutFloor(0.2);
      if (floorTween) tl.add(floorTween, 0);
      const diskTween = fadeOutDisk(0.2);
      if (diskTween) tl.add(diskTween, 0);
      // fade out the title
      const activeTitle = landingScene.titles.getActiveTitleGroup();
      if (activeTitle) {
        activeTitle.children.forEach((child) => {
          if (child instanceof THREE.Mesh) {
            gsap.to(child.material, { opacity: 0, duration: 0.2, ease: 'sine.inOut' });
          }
        });
      }
    

      // Ensure overlay is laid out so anchors can be measured. The overlay
      // is a 3x3 grid (grid-cols-3 grid-rows-3) so each section's wrapper
      // (display: contents) lays its title, content, #modelBg and
      // #detail-close out into the right cells when it becomes active.
      // `display` must stay a discrete DOM flip (CSS can't transition from
      // `display: none` to a layout box), but the opacity fade-in/out is
      // now a pure CSS transition triggered by the `.is-open` class.
      detailOverlay.style.display = 'grid';
      detailOverlay.classList.remove('is-open');

      // Each section owns its own #modelBg and #detail-close inside a
      // `display: contents` wrapper. Unhide the active wrapper BEFORE
      // measuring the model anchor, otherwise the wrapper is `display: none`
      // and the anchor's bounding rect collapses to zero.
      const activeSection = landingScene.getActiveSection();
      if (activeSection) {
        showActiveDetailView(activeSection.htmlDetailViewSelector);
      }
      const detailRoot = activeSection
        ? document.querySelector<HTMLElement>(activeSection.htmlDetailViewSelector)
        : null;
      const modelAnchor = detailRoot?.querySelector<HTMLElement>('#modelBg') ?? null;

      

      
      
      const proximityFactor = .8;

      // Helper to move and orient a group to a screen anchor and face the camera
      /**
       * Move and orient a group to a screen anchor and face the camera, with optional custom move/rotate and debug helpers.
       * @param {Group} group - The group to move/orient
       * @param {HTMLElement} anchorEl - The HTML anchor element
       * @param {Object} [opts]
       *   @param {Object} [opts.move] - {x, y, z} offset to add to the final position
       *   @param {Object} [opts.rotate] - {x, y, z} Euler angles (radians) to apply after facing camera
       *   @param {Object} [opts.scale] - Scale factor for the group
       *   @param {Group} [opts.model] - Optionally, a different group to move/rotate (default: group)
       *   @param {boolean} [opts.debug] - If true, add debug sphere/axes
       *  
       */
      const moveAndOrientGroup = (
        group: Group,
        anchorEl: HTMLElement | null,
        opts?: {
          move?: { x?: number; y?: number; z?: number };
          rotate?: { x?: number; y?: number; z?: number };
          scale?: number;
          model?: Group;
          debug?: boolean;
        }
      ) => {
        if (!group || !anchorEl) return;
        const { move, rotate,scale, model, debug } = opts || {};
        const targetGroup = model || group;

        // DEBUG: agregar punto y axes helper al centro del grupo solo si debug
        if (debug) {
          const debugSphereGeometry = new THREE.SphereGeometry(10, 16, 16);
          const debugSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff });
          const debugSphere = new THREE.Mesh(debugSphereGeometry, debugSphereMaterial);
          debugSphere.name = 'DEBUG_CENTER_SPHERE';
          targetGroup.add(debugSphere);
          const axesHelper = new THREE.AxesHelper(100);
          axesHelper.name = 'DEBUG_AXES_HELPER';
          targetGroup.add(axesHelper);
        }

        const worldPos = new Vector3();
        targetGroup.getWorldPosition(worldPos);
        const distance = landingScene.camera.position.distanceTo(worldPos);
        const screen = getAnchorCenter(anchorEl);
        const worldTarget = screenToWorldAtDistance(screen.x, screen.y, landingScene.camera, distance * proximityFactor);
        let localTarget = targetGroup.parent ? targetGroup.parent.worldToLocal(worldTarget.clone()) : worldTarget.clone();
        
        //  face the group to the camera by calculating the lookAt rotation first
        // save the first rotation to comeback later 
        const firstRotation = targetGroup.rotation.clone();
        // rotate the group to face the camera
        targetGroup.lookAt(landingScene.camera.position);
        
        let rotationX = targetGroup.rotation.x;
        let rotationY = targetGroup.rotation.y;
        let rotationZ = targetGroup.rotation.z;
        
        // apply the first rotation
        targetGroup.rotation.copy(firstRotation);
        
        let groupScale = opts?.scale || 1;
        // Apply move offset if provided        
        if (move) {
          localTarget.x += move.x ?? 0;
          localTarget.y += move.y ?? 0;
          localTarget.z += move.z ?? 0;
        }
        if (rotate) {
          rotationX += (opts?.rotate?.x || 0);
          rotationY += (opts?.rotate?.y || 0);
          rotationZ += (opts?.rotate?.z || 0);
        }
        if (scale) {
          groupScale = opts?.scale || 1 ;
        }
        
        // if in the especific group, override the rotation and position
        console.log("group id", group.id);
        
        if (group.id === 22) { // mountain
          rotationX += MathUtils.degToRad(-7);
          localTarget.z -= 20;
          localTarget.y -= 20;
        }
        if (group.id === 28) { // cube gear
          // -y & +x
          localTarget.y -= 35;
          localTarget.x += 30;
        }
        if (group.id === 26) { // hands
          // do nothing
          // rotate the hands to face the camera
          rotationY += MathUtils.degToRad(45); 
          rotationX += MathUtils.degToRad(-15); 
          localTarget.z += 40;
          localTarget.x += 130;
        }
        if (group.id === 24) { // thinking man
          firstThinkingManRotationY = targetGroup.children[0].rotation.y;
          
          localTarget.y -= 60;
          localTarget.x -= 70;
          gsap.to(targetGroup.children[0].rotation, { y: MathUtils.degToRad(-45), duration: 0.5, ease: 'power3.inOut',delay: 0.3 });
          rotationY += MathUtils.degToRad(-15);
          
        }
        
        
        
        
        
        
        const animationDuration = 0.3;
        tl.to(targetGroup.rotation, { x: rotationX || 0, y: rotationY || 0, z: rotationZ || 0,  duration: animationDuration, ease: 'power3.inOut',}, ">-=0.1"); 
        tl.to(targetGroup.position, { x: localTarget.x, y: localTarget.y, z: localTarget.z, duration: animationDuration, ease: 'power3.inOut' }, "<");
        tl.to(targetGroup.scale, { x: groupScale, y: groupScale, z: groupScale, duration: animationDuration, ease: 'power3.inOut' }, "<");
        
      };

      // Dynamically move and orient both groups
      moveAndOrientGroup(activeBackdropGroup, modelAnchor,{
        move:{x: -50},
        rotate:{y: MathUtils.degToRad(-45),x: MathUtils.degToRad(-7)},
      }); // move backdrop to model anchor with some offset

      // Show HTML layout (the wrapper was already unhidden above so the
      // model anchor could be measured; this call is still useful because
      // it re-asserts the active state in case any other section leaked).
      if (activeSection) {
        showActiveDetailView(activeSection.htmlDetailViewSelector);
      }
tl.call(() => {
        // Trigger the CSS opacity fade-in. The wrapper already has
        // `display: grid` from the pre-setup above and the
        // `transition-opacity duration-300` utility handles the timing.
        detailOverlay.classList.add('is-open');
      }, [], "<");
      


      // After the fade-in finishes, run the section's entry animations
      // (typing, marquee, ScrollTrigger refresh, ...). We wait a tick to
      // ensure the detail overlay is fully visible.
      tl.call(() => {
        // Show the close button (scoped to the active section's wrapper).
        const closeBtn = detailRoot?.querySelector<HTMLElement>('#detail-close');
        if (closeBtn) closeBtn.classList.remove('hidden');

        // Reveal the section's title letter-by-letter.
        if (activeSection) {
          const sectionRoot = document.querySelector<HTMLElement>(activeSection.htmlDetailViewSelector);
          // Trigger section-specific entry hooks (typing, etc.).
          getSectionHooks(activeSection.id).start?.();
        }
      });

    } else {
      // close the detail view
      // restore the overflow of the html body
      document.body.style.overflowY = 'auto';
      document.body.style.overflowX = 'hidden';
      // restore sections scroll
      document.querySelector<HTMLElement>('#experienceDetailedView')?.scrollTo({ top: 0, behavior: 'auto' });
      document.querySelector<HTMLElement>('#projectsDetailedView')?.scrollTo({ top: 0, behavior: 'auto' });

      // Restore the pixel ratio captured when the detail view opened.
      if (detailViewSavedPixelRatio !== null) {
        landingScene.setPixelRatio(detailViewSavedPixelRatio);
        detailViewSavedPixelRatio = null;
      }
      
      
      
      // Quitar la luz direccional si existe
      if (detailViewLight) {
        landingScene.scene.remove(detailViewLight);
        detailViewLight.dispose && detailViewLight.dispose();
        detailViewLight = null;
      }
      // EXIT DETAIL VIEW
      const tl = gsap.timeline({
        onComplete: () => {
          landingScene.controls.enabled = true;
          // Re-enable idle-orbit scheduling and arm the resume timer so the
          // camera respects the usual inactivity delay before resuming the
          // auto-rotation, instead of starting to spin the moment the
          // detail view closes.
          landingScene.setAutoRotateSuppressed(false);
          landingScene.scheduleOrbitResume();
          landingScene.titles.setPaused(false);
          landingScene.controls.dampingFactor = 0.06;
        }
      });
      // Reset the camera target to the default position 
      tl.to(landingScene.controls.target, { x: 0, y: cameraTargetYPosition, z: 0, duration: 0.3, ease: 'power3.inOut' }, "<");
      
      // Close the detail overlay: kick off the opacity fade-out (CSS
      // transition) and schedule the discrete `display: none` flip for
      // after the transition completes. The re-entrancy guard re-checks
      // `.is-open` before hiding so a quick reopen during the fade does
      // not strand the overlay with `display: none`.
      detailOverlay.classList.remove('is-open');
      window.setTimeout(() => {
        if (!detailOverlay.classList.contains('is-open')) {
          detailOverlay.style.display = 'none';
        }
      }, DETAIL_OVERLAY_FADE_MS);
      hideAllDetailViews();

      // Stop the section's running animations (typing, etc.) and reset the
      // letter reveal state of the previously active section.
      const previousSection = landingScene.getActiveSection();
      const previousRoot = previousSection
        ? document.querySelector<HTMLElement>(previousSection.htmlDetailViewSelector)
        : null;

      // Hide the close button (scoped to the previous section's wrapper) and
      // reset the section's title reveal so the next open replays the entry.
      const closeBtn = previousRoot?.querySelector<HTMLElement>('#detail-close');
      if (closeBtn) closeBtn.classList.add('hidden');
      if (previousSection) {
        getSectionHooks(previousSection.id).stop?.();
      }

      const floorInTween = fadeInFloor(0.3);
      if (floorInTween) tl.add(floorInTween, 0.2);
      const diskInTween = fadeInDisk(0.3);
      if (diskInTween) tl.add(diskInTween, 0.2);
      
      

      if (activeBackdropGroup) {
        tl.to(activeBackdropGroup.position, { x: 0, y: 0, z: 0, duration: 0.8, ease: 'power3.inOut' }, 0.1);
        tl.to(activeBackdropGroup.quaternion, { x: 0, y: 0, z: 0, w: 1, duration: 0.8, ease: 'power3.inOut' }, 0.1); // RESTAURAR QUATERNION
        tl.to(activeBackdropGroup.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'power3.inOut' }, 0.1);
        
        // si el grupo tiene un mesh específico para el título, también restaurar su rotación y posición
        if (activeBackdropGroup.id === 24) { // mountain
          // do nothing
        }
        if (activeBackdropGroup.id === 30) { // cube gear
          // do nothing
        }
        if (activeBackdropGroup.id === 28) { // hands
          // do nothing
        }
        if (activeBackdropGroup.id === 21) { // thinking
          tl.to(activeBackdropGroup.children[0].rotation, { y: firstThinkingManRotationY, duration: 0.5, ease: 'power3.inOut' }, 0.1);

        }

      }
      const activeTitle = landingScene.titles.getActiveTitleGroup();
      if (activeTitle) {
        activeTitle.children.forEach((child) => {
          if (child instanceof THREE.Mesh) {
            // a little bit after the before animation
            tl.to(child.material, { opacity: 1, duration: .2, ease: 'sine.inOut' },">");
          }
        });
      }
      
      

    }
  };


  // Track the object hit on pointerdown to validate pointerup
  let pointerDownHit: THREE.Object3D | null = null;

  const handlePointerDown = (event: PointerEvent) => {
    if (isDetailView || isSpaceIntroPlaying) return;

    updateMouseCoords(event);
    raycaster.setFromCamera(mouse, landingScene.camera);
    const hits = raycaster.intersectObjects(
      [
        landingScene.titles.getActiveBackdropGroup(),
        landingScene.titles.getActiveTitleGroup(),
      ].filter(Boolean) as THREE.Object3D[],
      true,
    );
    pointerDownHit = hits.length > 0 ? hits[0].object : null;
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (isDetailView || isSpaceIntroPlaying) return;
    if (!pointerDownHit) return;

    updateMouseCoords(event);
    raycaster.setFromCamera(mouse, landingScene.camera);
    const hits = raycaster.intersectObjects(
      [
        landingScene.titles.getActiveBackdropGroup(),
        landingScene.titles.getActiveTitleGroup(),
      ].filter(Boolean) as THREE.Object3D[],
      true,
    );

    // Only trigger if pointerup hit the same object as pointerdown
    if (hits.length > 0 && hits[0].object === pointerDownHit) {
      handleToggle("open");
    }
    pointerDownHit = null;
  };

  const handleOverlayClick = (_event: MouseEvent) => {
    // Click validation is now handled by pointerdown/pointerup
    // This listener is kept for potential future use but the actual
    // open trigger happens in handlePointerUp
  };

  // Close buttons (one per section). Only the active section's button is
  // visible at any time, so attaching the same handler to all of them is
  // safe — clicking any of them just closes the detail view.
  detailOverlay.querySelectorAll<HTMLElement>('#detail-close').forEach((closeButton) => {
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      handleToggle("close");
    });
  });

  overlay.addEventListener('pointerdown', handlePointerDown);
  overlay.addEventListener('pointerup', handlePointerUp);
  overlay.addEventListener('click', handleOverlayClick);

  // Programmatic open used by the menu popup. The orchestrator handles
  // the camera slide and then asks the toggle to open. We expose it
  // through the same handle so SPA re-init can still call `close`.
  let pendingOpenSection: number | null = null;

  const navigateToSectionAndOpenDetailView = (sectionIndex: number) => {
    // ensure it's all scrolled to the bottom, otherwise scroll
    const scrolled = window.scrollY + window.innerHeight >= document.body.scrollHeight - 1;
    if (!scrolled) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return
    }
    
    landingScene.navigateToSection(sectionIndex).then(() => {
      handleToggle("open");
    });
  };
  return {
    close: () => handleToggle("close"),
    openSection: navigateToSectionAndOpenDetailView,
  };
}

// Track the currently mounted landing scene so repeated inits (SPA
// navigation) can dispose the previous one before constructing a new one.
// Without this guard each navigation built a fresh scene and leaked the
// previous one (render loop, listeners, GPU textures), which is what
// produced the duplicated fetches visible in the Network panel.
let activeLandingScene: LandingScene | null = null;

export const initializeHomeLandingScene = async (lang: Lang = 'en') => {
  window.scrollTo(0, 0);

  const heroMask = document.querySelector('#hero-mask');
  const overlay = document.querySelector('#three-overlay') as HTMLElement | null;
  const contentEl = document.querySelector('#content');

  // Dispose any scene left over from a previous init (SPA navigation,
  // language toggle, ...). The model cache survives the dispose so the
  // next scene skips re-downloading every STL/GLTF.
  if (activeLandingScene) {
    try {
      activeLandingScene.dispose();
    } catch (err) {
      console.warn('Landing scene dispose error:', err);
    }
    activeLandingScene = null;
  }

  // Drain any lightweight cleanups the previous init registered (e.g.
  // wheel/touchmove listeners installed by `buildLightweightIntro`).
  // Without this drain they would accumulate across SPA navigations.
  lightCleanupFns.splice(0).forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.warn('Light cleanup error:', err);
    }
  });

  // Prime the shared model cache for the disk + every title + every
  // backdrop before the scene mounts. The subsequent calls inside
  // `createHomeLandingThreeScene` (`loadLandingDisk`, `createLandingTitles`
  // → `loadBackdrops`) hit the same cache and resolve synchronously, so
  // by the time `buildLandingTimeline` finishes its other awaits the
  // orchestration work is already done. Without this pre-warm the disk
  // and the first backdrop can still be in flight when the user scrolls
  // past the wait gate, producing a momentary empty section.
  await Promise.all([
    preloadLandingDisk(),
    preloadLandingModels(lang),
  ]);

  const landingScene = createHomeLandingThreeScene(overlay, lang);
  activeLandingScene = landingScene;

  if (!heroMask) {
    return;
  }

  const detailToggle = overlay && landingScene
    ? setupDetailViewToggle(landingScene, overlay)
    : null;

  // The menu popup dispatches a CustomEvent with the target section index
  // when the user picks a section. We bridge it into the toggle so the
  // camera slides to the section and then the detail view opens.
  if (typeof window !== 'undefined') {
    window.addEventListener('portfolio:navigate-section', (event: Event) => {
      const detail = (event as CustomEvent<{ sectionIndex: number }>).detail;
      const sectionIndex = detail?.sectionIndex;
      if (typeof sectionIndex !== 'number') return;
      detailToggle?.openSection(sectionIndex);
    });

    // Mobile-only quick escape from the menu: the popup exposes a "Back
    // to home" item that fires this event. `close()` is a no-op when the
    // detail view is already closed, so it's safe to dispatch from any
    // menu state.
    window.addEventListener('portfolio:close-detail', () => {
      detailToggle?.close();
    });
  }



  // Register a one-shot `pagehide` cleanup for any lightweight state
  // accumulated during this init. Guarded so multiple inits (SPA
  // navigation) only register one listener.
  if (!lightPagehideRegistered && typeof window !== 'undefined') {
    lightPagehideRegistered = true;
    window.addEventListener(
      'pagehide',
      () => {
        if (activeLandingScene) {
          try {
            activeLandingScene.dispose();
          } catch (err) {
            console.warn('Landing scene dispose error:', err);
          }
          activeLandingScene = null;
        }
        lightCleanupFns.splice(0).forEach((fn) => {
          try {
            fn();
          } catch (err) {
            console.warn('Light cleanup error:', err);
          }
        });
      },
      { once: true },
    );
  }

  await buildLandingTimeline(heroMask, contentEl, landingScene, () => {
    detailToggle?.close();
  });

  // The `#landing-arrow` reveal moved inside `buildLandingTimeline` so it
  // is tied to the same condition that unlocks scroll (STLs + textures
  // decoded). By the time we get here it is already visible.
};








// --------------
const getAnchorCenter = (el: HTMLElement) => {
    // the el is needed to properly position the titles, but in case it can't be found we fallback to some percentage-based screen positions
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
  
const screenToWorldAtDistance = (clientX: number, clientY: number, camera: Camera, distance: number) => {
  const ndc = new Vector3((clientX / window.innerWidth) * 2 - 1, - (clientY / window.innerHeight) * 2 + 1, 0.5);
  ndc.unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  return camera.position.clone().add(dir.multiplyScalar(distance));
};