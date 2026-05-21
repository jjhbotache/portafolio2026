/*
el david pensando
*/

import * as THREE from 'three';
import type { TitleBackgroundController } from './types';
import { cloneBackdropModel, placeBackdropBehindTitle } from './shared';
import { addPlanarUvs, materialFactory } from '../materialFactory';
import gsap from 'gsap';

const ABOUT_ME_SPIN_MULTIPLIER = 4;
const ABOUT_ME_MIN_ROTATION_DELTA = 0.0001;
const ABOUT_ME_MODEL_PATHS = ['/3d/man_thinking.stl'] as const;

export const createAboutMeBackground = (): TitleBackgroundController => {
  let backdropMaterials: THREE.Material[] | null = null;
  let showTween: gsap.core.Tween | null = null;
  let previousCameraYaw: number | null = null;
  let groupToBeSpinned: THREE.Group | null = null;
  

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

      model.rotation.x = THREE.MathUtils.degToRad(-90);
      model.rotation.z = THREE.MathUtils.degToRad(180);
      
      
      
      
      groupToBeSpinned = new THREE.Group();
      groupToBeSpinned.add(model);
      
      // align the model center to its group center
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
              
      placeBackdropBehindTitle(groupToBeSpinned, titleSize,{scaleFactor: 8,yOffset: 20});
      
      
      backdropGroup.add(groupToBeSpinned);

      return materials;
    },
    onShow: () => {
      // always start in the correct angle
      groupToBeSpinned?.rotation.set(0, 0, 0);
      
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
      if (!groupToBeSpinned) return;

      if (camera) {
        const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        const currentYaw = e.y;

        if (previousCameraYaw === null) {
          previousCameraYaw = currentYaw;
        } else {
          let deltaYaw = currentYaw - previousCameraYaw;
          while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
          while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;

          if (Math.abs(deltaYaw) > ABOUT_ME_MIN_ROTATION_DELTA) {
            groupToBeSpinned.rotateY(deltaYaw * ABOUT_ME_SPIN_MULTIPLIER);
          }

          previousCameraYaw = currentYaw;
        }
      }
    },
    dispose: () => {
      groupToBeSpinned = null;
      previousCameraYaw = null;
    },
  };
};
