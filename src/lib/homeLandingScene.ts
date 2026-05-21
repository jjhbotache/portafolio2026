import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createHomeLandingThreeScene, resetCameraToInitialPosition, type LandingScene } from './three/homeLandingThreeScene';
import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';

gsap.registerPlugin(ScrollTrigger);
const buildLandingTimeline = (heroMask: Element, landingScene: LandingScene | null) => {
  let SpaceIntroPlayed = false;
  let previousScrollYProgress = -1;
  let goingDown = false;
  
  // executed when the user scrolls back up
  function reset3D () {
    if (!landingScene) return;
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

    function onPointerDown() {
      stop();
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

export const initializeHomeLandingScene = () => {
  window.scrollTo(0, 0);

  const heroMask = document.querySelector('#hero-mask');
  const overlay = document.querySelector('#three-overlay') as HTMLElement | null;

  const landingScene = createHomeLandingThreeScene(overlay);

  if (!heroMask) {
    return;
  }

  buildLandingTimeline(heroMask, landingScene);
};
