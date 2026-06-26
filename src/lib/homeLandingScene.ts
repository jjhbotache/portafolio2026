import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createHomeLandingThreeScene, resetCameraToInitialPosition, type LandingScene } from './three/homeLandingThreeScene';
import { CatmullRomCurve3, MathUtils, Vector3, Camera, Group } from 'three';
import { fadeOutDisk, fadeInDisk } from './three/homeLandingDisk';
import { fadeOutFloor, fadeInFloor } from './three/homeLandingEnvironment';
import { sections } from './sections';
import { revealActiveSectionTitle, resetActiveSectionTitle } from './textReveal';
import * as THREE from 'three';

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

gsap.registerPlugin(ScrollTrigger);
const buildLandingTimeline = (heroMask: Element, landingScene: LandingScene | null, onReset?: () => void) => {
  let SpaceIntroPlayed = false;
  let previousScrollYProgress = -1;
  let goingDown = false;
  
  // executed when the user scrolls back up
  function reset3D () {
    if (!landingScene) return;
    // also close the detail view (if it is open) so we never leave it dangling
    // after the user scrolls back up out of the 3D scene
    onReset?.();
    landingScene.hideTitles();
    // reset visibility of the overlay
    gsap.to(landingScene.overlay, {
      autoAlpha: 0,
      pointerEvents: 'none',
      duration: 0.2,
      ease: 'none',
      onComplete: () => {
        resetCameraToInitialPosition(landingScene.camera);
        SpaceIntroPlayed = false;
      },
    });

  };
  // executed when the user scrolls down and reaches some percentage of the scroll
  function triggerSpaceIntroAnimation() {
        SpaceIntroPlayed = true;
        landingScene && SpaceIntroAnimation3D(landingScene);
        setTimeout(() => {
          window.scrollTo(0, 850);
        }, 2000);
  }
  
  const tl = gsap.timeline({
    onUpdate: () => {
      const progressPercent = Math.floor(tl.progress() * 100);
      goingDown = progressPercent > previousScrollYProgress;
      // console.log(`Scroll Progress: ${progressPercent}% -- ${previousScrollYProgress}%,   Going Down: ${goingDown}, Space Intro Played: ${SpaceIntroPlayed}`);
      if (progressPercent>80 && !SpaceIntroPlayed && goingDown) triggerSpaceIntroAnimation();
      previousScrollYProgress = progressPercent;
    },
    
    scrollTrigger: {
      trigger: heroMask,
      start: 'top top',
      end: '+=845',
      scrub: 1,
      pin: true,
      onEnterBack: reset3D
    },
  });

  tl.to(heroMask, {
    webkitMaskSize: '.2%',
    maskSize: '.2%',
    ease: 'sine.in',
    duration: 1,
  });

  tl.to('#content', {
    scale: 1,
    ease: 'power2.in',
    duration: 0.5,
  }, '<');

  tl.to(heroMask, {
    '--mask-pos': '50% 50%',
    ease: 'sine.in',
    duration: 0.4,
  }, 0.6);

  tl.to('#content', {
    filter: 'blur(30px)',
    ease: 'power4.in',
    duration: 0.4,
  }, 0.2);

  tl.to(heroMask, {
    '--hero-before-opacity': 1,
    ease: 'sine.out',
    duration: 0.5,
  }, 0.2);


};

function startTutorialIfNeeded(overlay: HTMLElement | null) {
  if (!overlay) return;

  try {
    const key = 'landing_tutorial_shown_count';
    const shownCount = Number(localStorage.getItem(key) ?? 0);
    if (!isNaN(shownCount) && shownCount >= 2) return;

    const tutorialOverlay = overlay.querySelector('#tutorial-overlay') as HTMLElement | null;
    const tutorialIcon = overlay.querySelector('#tutorial-icon') as HTMLElement | null;
    if (!tutorialOverlay || !tutorialIcon) return;

    // mark as shown (increment once per start)
    const newCount = Math.min(2, (isNaN(shownCount) ? 0 : shownCount) + 1);
    localStorage.setItem(key, String(newCount));

    // reveal
    tutorialOverlay.classList.add('visible');
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

function SpaceIntroAnimation3D(landingScene: LandingScene) {
  if (!landingScene) {
    return;
  }
  
  const tl = gsap.timeline({
    defaults: {
      ease: 'none',
    },
    onComplete: () => {
      landingScene.showTitles();
      startTutorialIfNeeded(landingScene.overlay);
    }
  });

  const cameraPathAnchors = [
    new Vector3(landingScene.camera.position.x, landingScene.camera.position.y, landingScene.camera.position.z),
    new Vector3(0, 8, 2),
    new Vector3(-4, 6, 0),
    new Vector3(-7, 2, 0),
  ];

  const cameraPathCurve = new CatmullRomCurve3(cameraPathAnchors, false, 'catmullrom', 0.6);

  const totalPathDistance = cameraPathAnchors
    .slice(1)
    .reduce((distance, point, index) => distance + point.distanceTo(cameraPathAnchors[index]), 0);

  const samplesCount = MathUtils.clamp(Math.round(totalPathDistance * 8), 40, 140);
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
  // return;
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
  
}

function setupDetailViewToggle(landingScene: LandingScene, overlay: HTMLElement) {
  let isDetailView = false;
  const detailOverlay = document.querySelector('#detail-overlay') as HTMLElement;
  let firstThinkingManRotationY: number = 0;
  
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

  overlay.addEventListener('mousemove', (event) => {
    if (isDetailView) return;
    updateMouseCoords(event);

    raycaster.setFromCamera(mouse, landingScene.camera);
    const objsToBeIntersected = [
      ...raycaster.intersectObject(landingScene.titles.getActiveTitleGroup()!, true),
      ...raycaster.intersectObject(landingScene.titles.getActiveBackdropGroup()!, true)
    ] ;

    if (objsToBeIntersected.length > 0) {
      overlay.style.cursor = 'pointer';
    } else {
      overlay.style.cursor = 'default';
    }
  });

  const handleToggle = (action: "open" | "close") => {
    isDetailView = action === "open";
    overlay.style.cursor = 'default';
    
    

    const activeBackdropGroup  = landingScene.titles.getActiveBackdropGroup();

    if (isDetailView) {
      
      // Agregar luz direccional en la posición de la cámara
      detailViewLight = new THREE.DirectionalLight(0x68d9ff, 40);
      detailViewLight.position.copy(landingScene.camera.position);
      landingScene.scene.add(detailViewLight);
      // ENTER DETAIL VIEW
      // pause the idle orbit behavior using the scene helper
      landingScene.pauseOrbit();
      
      landingScene.controls.enabled = false;
      landingScene.titles.setPaused(true);
      landingScene.controls.dampingFactor = 0.002;

      const tl = gsap.timeline();

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
      // is a 3x3 grid (grid-cols-3 grid-rows-3) so each section's title and
      // content land in the correct cells and #modelBg sits in row 2 col 3.
      gsap.set(detailOverlay, { display: 'grid', opacity: 0, pointerEvents: 'none' });

      const modelAnchor = document.querySelector('#modelBg') as HTMLElement ;

      

      
      
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
        anchorEl: HTMLElement,
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
        // console.log("group id", group.id);
        
        if (group.id === 24) { // mountain
          // do nothing
        }
        if (group.id === 30) { // cube gear
          // do nothing
        }
        if (group.id === 28) { // hands
          // do nothing
        }
        if (group.id === 21) { // thinking man
          firstThinkingManRotationY = targetGroup.children[0].rotation.y;
          
          localTarget.y -= 20;
          localTarget.x -= 20;
          gsap.to(targetGroup.children[0].rotation, { y: MathUtils.degToRad(-45), duration: 0.5, ease: 'power3.inOut',delay: 0.3 });
          
        }
        
        
        
        
        
        
        const animationDuration = 0.3;
        tl.to(targetGroup.rotation, { x: rotationX || 0, y: rotationY || 0, z: rotationZ || 0,  duration: animationDuration, ease: 'power3.inOut',}, ">-=0.1"); 
        tl.to(targetGroup.position, { x: localTarget.x, y: localTarget.y, z: localTarget.z, duration: animationDuration, ease: 'power3.inOut' }, "<");
        tl.to(targetGroup.scale, { x: groupScale, y: groupScale, z: groupScale, duration: animationDuration, ease: 'power3.inOut' }, "<");
        
      };

      // Dynamically move and orient both groups
      moveAndOrientGroup(activeBackdropGroup, modelAnchor,{
        move:{x: -50},
        rotate:{y: MathUtils.degToRad(-45),x: MathUtils.degToRad(-7)}
      }); // move backdrop to model anchor with some offset

      // Show HTML layout
      const activeSection = landingScene.getActiveSection();
      if (activeSection) {
        showActiveDetailView(activeSection.htmlDetailViewSelector);
      }
      tl.to(detailOverlay, { opacity: 1, display: 'grid', pointerEvents: 'auto', duration: 0.2 }, "<");

      // After the fade-in finishes, run the section's entry animations
      // (typing, marquee, ScrollTrigger refresh, ...). We wait a tick to
      // ensure the detail overlay is fully visible.
      tl.call(() => {
        // Show the close button.
        const closeBtn = detailOverlay.querySelector<HTMLElement>('#detail-close');
        if (closeBtn) closeBtn.classList.remove('hidden');

        // Reveal the section's title letter-by-letter.
        if (activeSection) {
          const sectionRoot = document.querySelector<HTMLElement>(activeSection.htmlDetailViewSelector);
          revealActiveSectionTitle(sectionRoot);
          // Trigger section-specific entry hooks (typing, etc.).
          getSectionHooks(activeSection.id).start?.();
        }
      });

    } else {
      
      
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
          landingScene.controls.autoRotate = true;
          landingScene.titles.setPaused(false);
          landingScene.controls.dampingFactor = 0.06;
        }
      });
      
      tl.to(detailOverlay, { opacity: 0, display: 'none', pointerEvents: 'none', duration: 0.3 }, 0);
      hideAllDetailViews();

      // Hide the close button and reset the section's title reveal so the
      // next open replays the entry animation.
      const closeBtn = detailOverlay.querySelector<HTMLElement>('#detail-close');
      if (closeBtn) closeBtn.classList.add('hidden');

      // Stop the section's running animations (typing, etc.) and reset the
      // letter reveal state of the previously active section.
      const previousSection = landingScene.getActiveSection();
      if (previousSection) {
        const sectionRoot = document.querySelector<HTMLElement>(previousSection.htmlDetailViewSelector);
        resetActiveSectionTitle(sectionRoot);
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

  // Click handler: when the detail view is open, only close if the click
  // landed outside of the section's content area. Clicks inside the content
  // (cards, typing, sliders) bubble up but don't close.
  const isClickInsideSectionContent = (target: EventTarget | null): boolean => {
    if (!(target instanceof Node)) return false;
    const content = (target as Element).closest?.('[data-section-content]');
    return Boolean(content);
  };

  const handleOverlayClick = (event: MouseEvent) => {
    if (isDetailView) {
      // While in detail view, the three-overlay doesn't receive clicks (the
      // detail overlay is on top). Closing is handled by the detail overlay's
      // click listener below. Nothing to do here.
      return;
    }

    raycaster.setFromCamera(mouse, landingScene.camera);
    if (raycaster.intersectObject(landingScene.titles.getActiveBackdropGroup()!).length > 0
    || raycaster.intersectObject(landingScene.titles.getActiveTitleGroup()!).length > 0) {
      handleToggle("open");
    }
  };

  // Close button: always closes the detail view.
  const closeButton = detailOverlay.querySelector<HTMLElement>('#detail-close');
  if (closeButton) {
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      handleToggle("close");
    });
  }

  // Click on the detail overlay: close only if the click landed on the
  // overlay itself (not on a section's content).
  detailOverlay.addEventListener('click', (event) => {
    if (isClickInsideSectionContent(event.target)) {
      return;
    }
    // Ignore clicks on the close button (already handled by its own listener).
    if (event.target instanceof Element && event.target.closest('#detail-close')) {
      return;
    }
    handleToggle("close");
  });

  overlay.addEventListener('click', handleOverlayClick);

  return {
    close: () => handleToggle("close"),
  };
}

export const initializeHomeLandingScene = () => {
  window.scrollTo(0, 0);

  const heroMask = document.querySelector('#hero-mask');
  const overlay = document.querySelector('#three-overlay') as HTMLElement | null;

  const landingScene = createHomeLandingThreeScene(overlay);

  if (!heroMask) {
    return;
  }

  const detailToggle = overlay && landingScene
    ? setupDetailViewToggle(landingScene, overlay)
    : null;

  buildLandingTimeline(heroMask, landingScene, () => {
    detailToggle?.close();
  });
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