import * as THREE from 'three';
import type { TitleBackgroundController } from './types';
import { cloneBackdropModel, placeBackdropBehindTitle } from './shared';
import { gsap } from "gsap";

const CONTACT_MODEL_PATHS = ['/3d/the_creation_of_adam.glb'] as const;

const MIN_CAMERA_YAW_DEG = -45; // from yaw angle
const MAX_CAMERA_YAW_DEG = -134; // to yaw angle
const HANDS_TO_DISTANCE = 3; 
const HAND_MAX_ROTATION_DEG = -90;
let HANDS_FROM = {
  izq: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
  der: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
}; // how much the hands move towards/away from the camera at max rotation

export const createContactBackground = (): TitleBackgroundController => {
  let hands: THREE.Object3D[] = [];
  let previousCameraQuaternion: THREE.Quaternion | null = null;
  let startCameraYaw: number | null = null;

  // Store original local transforms so hands remain idle but ready to animate
  let handOriginalPositions: THREE.Vector3[] = [];
  let handOriginalQuaternions: THREE.Quaternion[] = [];

  const cameraEuler = new THREE.Euler();
  let leftHandTl = gsap.timeline({ repeat: -1, yoyo: true,paused: true });
  let rightHandTl = gsap.timeline({ repeat: -1, yoyo: true,paused: true });

  return {
    modelPaths: CONTACT_MODEL_PATHS,
    onLoad: ({ sourceModels, backdropGroup, titleSize }) => {
      const sourceModel = sourceModels[0];
      if (!sourceModel) return [];

      const firstClone = cloneBackdropModel(sourceModel);

      placeBackdropBehindTitle(firstClone.model, titleSize);

      firstClone.model.scale.setScalar(200);
      firstClone.model.rotation.set(0, THREE.MathUtils.degToRad(90), 0);
      const modelBounds = new THREE.Box3().setFromObject(firstClone.model);
      const modelSize = new THREE.Vector3();
      modelBounds.getSize(modelSize);
      firstClone.model.position.x -= modelSize.x / 2;

      // Detect candidate groups that contain meshes (prefer 'hand' names)
      hands = [];
      const candidates: Array<{ node: THREE.Object3D; meshCount: number; directMeshCount: number; name: string }> = [];

      firstClone.model.traverse((child) => {
        if (child instanceof THREE.Mesh) return;
        if (!child.name) return;

        let meshCount = 0;
        let directMeshCount = 0;
        child.traverse((n) => {
          if (n instanceof THREE.Mesh) meshCount++;
        });
        for (const c of child.children) if (c instanceof THREE.Mesh) directMeshCount++;

        if (meshCount === 0) return;

        candidates.push({ node: child, meshCount, directMeshCount, name: child.name });
      });

      candidates.sort((a, b) => {
        const score = (x: typeof a) => {
          let s = 0;
          if (/hand/i.test(x.name)) s += 1000;
          if (/^export/i.test(x.name)) s += 900;
          s += x.directMeshCount * 50 + x.meshCount;
          return s;
        };
        return score(b) - score(a);
      });

      for (let i = 0; i < Math.min(2, candidates.length); i++) hands.push(candidates[i].node);


      // Save original local transforms so the hands stay idle and are ready to animate later
      handOriginalPositions = hands.map((h) => h.position.clone());
      handOriginalQuaternions = hands.map((h) => h.quaternion.clone());
      

      previousCameraQuaternion = null;
      startCameraYaw = null;
      
      // move hands to be closer
      hands.forEach((hand, i) => {
        if (i % 2 === 0) {
          // Mano derecha
          hand.position.z -= .13;
          hand.position.y -= .2;
          
          // save for the from
          HANDS_FROM.der.pos = hand.position.clone();
          HANDS_FROM.der.rot = hand.rotation.clone();
          
        } else {
          // Mano izquierda
          hand.position.z += .13;
          // save for the from
          HANDS_FROM.izq.pos = hand.position.clone();
          HANDS_FROM.izq.rot = hand.rotation.clone();
        }
      });
      
      
      hands.forEach((hand, i) => {
        if (i % 2 === 0) {
          // Mano derecha
          rightHandTl.to( hand.rotation, { z: THREE.MathUtils.degToRad(HAND_MAX_ROTATION_DEG) }, 0)
          rightHandTl.to( hand.rotation, { z: HANDS_FROM.der.rot.z } , "50%") // vuelve a la posición original  
          rightHandTl.to( hand.rotation, { z: THREE.MathUtils.degToRad(HAND_MAX_ROTATION_DEG) },"100%")
          
          rightHandTl.to( hand.position, { z: HANDS_FROM.der.pos.z + HANDS_TO_DISTANCE }, 0) // mueve la mano hacia la cámara mientras rota
          rightHandTl.to( hand.position, { z: HANDS_FROM.der.pos.z }, "50%") // vuelve a la posición original
          rightHandTl.to( hand.position, { z: HANDS_FROM.der.pos.z + HANDS_TO_DISTANCE }, "100%") // mueve la mano hacia la cámara mientras rota
          
        } else {
          // Mano izquierda
          leftHandTl.to( hand.rotation, { y: THREE.MathUtils.degToRad(-HAND_MAX_ROTATION_DEG) }, 0)
          leftHandTl.to( hand.rotation, { y: HANDS_FROM.izq.rot.z } , "50%") // vuelve a la posición original  
          leftHandTl.to( hand.rotation, { y: THREE.MathUtils.degToRad(-HAND_MAX_ROTATION_DEG) },"100%")
          
          leftHandTl.to( hand.position, { z: HANDS_FROM.izq.pos.z - HANDS_TO_DISTANCE }, 0) // mueve la mano hacia la cámara mientras rota
          leftHandTl.to( hand.position, { z: HANDS_FROM.izq.pos.z }, "50%") // vuelve a la posición original
          leftHandTl.to( hand.position, { z: HANDS_FROM.izq.pos.z - HANDS_TO_DISTANCE }, "100%") // mueve la mano hacia la cámara mientras rota
        }
      });
      hands.forEach((hand, i) => {
        if (i % 2 === 0) {
          // Mano derecha
          const tl = gsap.timeline({ repeat: -1, yoyo: true });
          tl.fromTo(
            hand.rotation,
            { z: THREE.MathUtils.degToRad(HAND_MAX_ROTATION_DEG) },
            { z: HANDS_FROM.der.rot.z, duration: 5, ease: "bounce.out" }
          );
          tl.fromTo(
            hand.position,
            { z: HANDS_FROM.der.pos.z + HANDS_TO_DISTANCE },
            { z: HANDS_FROM.der.pos.z, duration: 5, ease: "bounce.out" },
            0
          ); // mueve la mano hacia abajo mientras rota
        } else {
          // Mano izquierda
          const tl = gsap.timeline({ repeat: -1, yoyo: true });
          tl.fromTo(
            hand.rotation,
            { y: THREE.MathUtils.degToRad(-HAND_MAX_ROTATION_DEG) },
            { y: HANDS_FROM.izq.rot.y, duration: 5, ease: "bounce.out" }
          );
          tl.fromTo(
            hand.position,
            { z: HANDS_FROM.izq.pos.z - HANDS_TO_DISTANCE },
            { z: HANDS_FROM.izq.pos.z, duration: 5, ease: "bounce.out" },
            0
          ); // mueve la mano hacia abajo mientras rota
        }
      });
      

      backdropGroup.clear();
      backdropGroup.add(firstClone.model);

      return [...firstClone.materials];
    },
    onShow: () => {
      previousCameraQuaternion = null;
      startCameraYaw = null;
      
      
      
    },
    onHide: () => {
      previousCameraQuaternion = null;
      startCameraYaw = null;
    },
    update: ({ camera }) => {
      // Always log camera rotation (yaw/pitch/roll) in degrees for debugging
      cameraEuler.setFromQuaternion(camera.quaternion, 'YXZ');
      const pitch = cameraEuler.x;
      const yaw = cameraEuler.y;
      const roll = cameraEuler.z;
      const pitchDeg = THREE.MathUtils.radToDeg(pitch);
      const yawDeg = THREE.MathUtils.radToDeg(yaw);
      const rollDeg = THREE.MathUtils.radToDeg(roll);

      // console.log(
      //   `[contactBackground] Camera rotation (deg) — yaw: ${yawDeg.toFixed(2)}, pitch: ${pitchDeg.toFixed(2)}, roll: ${rollDeg.toFixed(2)}`
      // );
      // log from 0 to 100 the pos
      
      const animationProgress = gsap.utils.mapRange(MIN_CAMERA_YAW_DEG,MAX_CAMERA_YAW_DEG,0,100,yawDeg);
      // update timelines based on camera yaw
      if(animationProgress > 0 && animationProgress < 100){
        leftHandTl.progress(animationProgress / 100);
        rightHandTl.progress(animationProgress / 100);
      }


      previousCameraQuaternion = camera.quaternion.clone();
    },
    dispose: () => {
      hands = [];
      previousCameraQuaternion = null;
      startCameraYaw = null;
      handOriginalPositions = [];
      handOriginalQuaternions = [];
    },
  };
};
