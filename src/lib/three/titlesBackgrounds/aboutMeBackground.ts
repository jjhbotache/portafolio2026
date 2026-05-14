/*
el david pensando
*/

import * as THREE from 'three';
import type { TitleBackgroundController } from './types';
import { cloneBackdropModel } from './shared';
import { addPlanarUvs, materialFactory } from '../materialFactory';
import gsap from 'gsap';

const ABOUT_ME_ROTATION_SMOOTHING = 0.9;
const ABOUT_ME_SPIN_MULTIPLIER = 6;
const ABOUT_ME_MIN_ROTATION_DELTA = 0.0001;
const ABOUT_ME_MODEL_PATHS = ['/3d/man_thinking.stl'] as const;

export const createAboutMeBackground = (): TitleBackgroundController => {
  let orientationRoot: THREE.Group | null = null;
  let spinRoot: THREE.Group | null = null;
  let backdropMaterials: THREE.Material[] | null = null;
  let showTween: gsap.core.Tween | null = null;
  let previousCameraYaw: number | null = null;
  const modelCenter = new THREE.Vector3();
  const modelBounds = new THREE.Box3();

  return {
    modelPaths: ABOUT_ME_MODEL_PATHS,
    onLoad: ({ sourceModels, backdropGroup, titleSize }) => {
      const sourceModel = sourceModels[0];
      if (!sourceModel) return [];
      
      

      
      // clone the source model and overwrite materials with platformDark while
      // preserving the animable opacity behavior
      const platformDark = materialFactory('platformDark');
      const { model, materials } = cloneBackdropModel(sourceModel, (material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.copy(platformDark);
        }
        // ensure backdrop materials are initially invisible and don't write depth
        material.transparent = true;
        material.opacity = 0;
        // disable depth write so invisible backdrops don't occlude others
        (material as THREE.Material).depthWrite = false as any;
        material.needsUpdate = true;
      });

      // keep a reference to materials so we can animate them on show/hide
      backdropMaterials = materials;

      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        if (child.geometry instanceof THREE.BufferGeometry) {
          const hasUvs = Boolean(child.geometry.getAttribute('uv'));
          if (!hasUvs) {
            addPlanarUvs(child.geometry);
          }
        }
      });

      model.position.y = -40;
      model.rotation.x = -Math.PI / 2;
      model.scale.setScalar(0.85);
      
      
      
      
      
      modelBounds.setFromObject(model).getCenter(modelCenter);

      orientationRoot = new THREE.Group();
      spinRoot = new THREE.Group();
      spinRoot.position.copy(modelCenter);
      model.position.sub(modelCenter);
      spinRoot.add(model);
      orientationRoot.add(spinRoot);
      

      previousCameraYaw = null;

      backdropGroup.clear();
      backdropGroup.add(orientationRoot);

      return materials;
    },
    onShow: () => {
      previousCameraYaw = null;

      if (backdropMaterials) {
        // kill any existing tweens
        showTween?.kill();

        // ensure materials are set for animation
        backdropMaterials.forEach((m) => {
          m.transparent = true;
          m.opacity = m.opacity ?? 0;
          (m as any).depthWrite = false; // keep false during fade-in to avoid occlusion
          m.needsUpdate = true;
        });

        showTween = gsap.to(backdropMaterials, {
          duration: 0.6,
          opacity: 1,
          ease: 'power1.inOut',
          onComplete: () => {
            // once fully visible, enable depth write for proper rendering
            backdropMaterials?.forEach((m) => {
              (m as any).depthWrite = true;
              m.needsUpdate = true;
            });
          },
        });
      }
    },
    onHide: () => {
      previousCameraYaw = null;

      if (backdropMaterials) {
        showTween?.kill();
        // immediately disable depth write to avoid occlusion while hidden
        backdropMaterials.forEach((m) => {
          (m as any).depthWrite = false;
          m.needsUpdate = true;
        });

        showTween = gsap.to(backdropMaterials, {
          duration: 0.35,
          opacity: 0,
          ease: 'power1.inOut',
        });
      }
    },
    update: ({ camera, titleQuaternion }) => {
      if (!orientationRoot || !spinRoot) return;

      orientationRoot.quaternion.slerp(titleQuaternion, ABOUT_ME_ROTATION_SMOOTHING);

      if (!camera) return;

      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      const currentYaw = e.y;

      if (previousCameraYaw === null) {
        previousCameraYaw = currentYaw;
        return;
      }

      let deltaYaw = currentYaw - previousCameraYaw;
      while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
      while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;

      if (Math.abs(deltaYaw) > ABOUT_ME_MIN_ROTATION_DELTA) {
        spinRoot.rotateY(deltaYaw * ABOUT_ME_SPIN_MULTIPLIER);
      }

      previousCameraYaw = currentYaw;
    },
    dispose: () => {
      orientationRoot = null;
      spinRoot = null;
      previousCameraYaw = null;
    },
  };
};
