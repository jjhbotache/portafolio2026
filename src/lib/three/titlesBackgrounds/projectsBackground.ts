/*
engranajes planetarios que giran lentamente
unas capas que recubren los engranajes y luego de adentro, empezara a brillar neon
*/




import * as THREE from 'three';
import gsap from 'gsap';
import type { TitleBackgroundController } from './types';
import { cloneBackdropModel } from './shared';
import { materialFactory } from '../materialFactory';

// Minimal projects background: loads one model and rotates it slowly.
const MODEL_PATH = ['/3d/gears.gltf'] as const;
const SPEED_MIN = 0.35;
const SPEED_MAX = 1.2;
const SPEED_CYCLE_SECONDS = 4.5;
const PROJECTS_SPIN_MULTIPLIER = 4;
const PROJECTS_MIN_ROTATION_DELTA = 0.0001;

export const createProjectsBackground = (): TitleBackgroundController => {
  let root: THREE.Group | null = null;
  let modelGroup: THREE.Group | null = null;
  let orientationRoot: THREE.Group | null = null;
  let spinRoot: THREE.Group | null = null;
  let collectedMaterials: THREE.Material[] = [];
  let lastTime = 0;
  let mixer: THREE.AnimationMixer | null = null;
  let speedTween: gsap.core.Tween | null = null;
  const speedController = { value: SPEED_MIN };
  let previousCameraYaw: number | null = null;
  // timer para animar si elapsedTime no avanza (usa Page Visibility API)
  const internalTimer = new THREE.Timer();

  return {
    modelPaths: MODEL_PATH,
    onLoad: ({ sourceModels,sourceAnimations, backdropGroup, titleSize }) => {
      if (!sourceModels || sourceModels.length === 0) return [];
      
      

      const source = sourceModels[0];
      if (!source) return [];

      const { model, materials } = cloneBackdropModel(source, (material) => { 
        material.color = new THREE.Color(0x2e2e37);
      });
      collectedMaterials = materials ?? [];

      // create the mixer bound to the cloned model
      mixer = new THREE.AnimationMixer(model);
      if (mixer && sourceAnimations) {
        const clips = sourceAnimations.get(source) ?? [];
        clips.forEach((clip) => {
          mixer!.clipAction(clip, model).play();
        });
      }

      speedTween?.kill();
      speedController.value = SPEED_MIN;
      speedTween = gsap.to(speedController, {
        value: SPEED_MAX,
        duration: SPEED_CYCLE_SECONDS,
        ease: 'expo.inOut',
        repeat: -1,
        yoyo: true,
        paused: true,
      });

      modelGroup = new THREE.Group();
      // add the cloned model (the one the mixer controls)
      modelGroup.add(model);


      // Compute bounds and scale so the model is visible relative to the title

      modelGroup.scale.setScalar(2000);
      modelGroup.translateZ(-115);
      modelGroup.translateY(15);


      root = new THREE.Group();
      root.add(modelGroup);

      backdropGroup.clear();
      backdropGroup.add(root);

      lastTime = 0;
      // connect timer to document (enables Page Visibility handling) y sincronizar
      if (typeof document !== 'undefined' && typeof internalTimer.connect === 'function') {
        try { internalTimer.connect(document); } catch (e) {}
      }
      internalTimer.update(performance.now());

      return collectedMaterials;
    },
    onShow: () => {
      lastTime = 0;
      // reset camera delta tracking so the first frame doesn't produce a large spin
      previousCameraYaw = null;
      speedTween?.resume();
      if (collectedMaterials && collectedMaterials.length) {
        collectedMaterials.forEach((m) => {
          try {
            (m as any).depthWrite = true;
            m.needsUpdate = true;
          } catch (e) {}
        });
      }
    },
    onHide: () => {
      lastTime = 0;
      speedTween?.pause();
      if (collectedMaterials && collectedMaterials.length) {
        collectedMaterials.forEach((m) => {
          try {
            (m as any).depthWrite = false;
            m.needsUpdate = true;
          } catch (e) {}
        });
      }
    },
    update: ({ elapsedTime, camera, titleQuaternion }) => {
      if (!modelGroup ) return;

      // prefer external elapsedTime when it advances; otherwise fallback to internal timer
      const extDelta = lastTime ? Math.max(0, elapsedTime - lastTime) : 0;
      let delta: number;
      const now = performance.now();
      if (extDelta > 0) {
        delta = extDelta;
        // update internal timer so it stays in sync
        internalTimer.update(now);
      } else {
        internalTimer.update(now);
        delta = internalTimer.getDelta();
      }
      lastTime = elapsedTime;

      if (mixer) {
        mixer.timeScale = speedController.value;
        mixer.update(delta);
      }


      if (camera) {
        const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        const currentYaw = e.y;

        if (previousCameraYaw === null) {
          previousCameraYaw = currentYaw;
        } else {
          let deltaYaw = currentYaw - previousCameraYaw;
          while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
          while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;

          if (Math.abs(deltaYaw) > PROJECTS_MIN_ROTATION_DELTA) {
            modelGroup.rotateY(deltaYaw * PROJECTS_SPIN_MULTIPLIER);
          }

          previousCameraYaw = currentYaw;
        }
      }
    },
    dispose: () => {
      if (root && root.parent) root.parent.remove(root);
      if (modelGroup) {
        modelGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            try { child.geometry?.dispose(); } catch (e) {}
            try {
              if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
              else child.material?.dispose();
            } catch (e) {}
          }
        });
      }
      collectedMaterials = [];
      modelGroup = null;
      spinRoot = null;
      orientationRoot = null;
      previousCameraYaw = null;
      root = null;
      lastTime = 0;
      speedTween?.kill();
      speedTween = null;
      try { internalTimer.dispose(); } catch (e) {}
    },
  };
};
