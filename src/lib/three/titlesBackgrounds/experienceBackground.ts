/*
montañas con una bandera titilante que avanza apareciendo cada vez mas adelante
*/


import gsap from 'gsap';
import type { TitleBackgroundController } from './types';
import { cloneBackdropModel, placeBackdropBehindTitle } from './shared';
import * as THREE from 'three';

const EXPERIENCE_MODEL_PATHS = ['/3d/mountain.stl'] as const;

export const createExperienceBackground = (): TitleBackgroundController => {
  let loopTimeline: gsap.core.Timeline | null = null;
  let climbTimeline: gsap.core.Timeline | null = null;
  let blinkTimeline: gsap.core.Timeline | null = null;
  let collectedMaterials: THREE.Material[] = [];

  return {
    modelPaths: EXPERIENCE_MODEL_PATHS,
    onLoad: ({ sourceModels, backdropGroup, titleSize }) => {
      const sourceModel = sourceModels[0];
      if (!sourceModel) {
        return [];
      }

      const { model, materials } = cloneBackdropModel(sourceModel);
      collectedMaterials = materials ?? [];
      
      // 1. Centrar la montaña: calculamos su caja delimitadora (bounding box) real 
      // y desplazamos sus hijos para que el origen (0,0,0) sea el centro geométrico.
      // 1. Primero centra
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.children.forEach((child) => {
        child.position.sub(center);
      });
      
      placeBackdropBehindTitle(model, titleSize);

      // 2. Luego rota
      
      model.position.set(0, 25, -70);
      model.rotation.set(THREE.MathUtils.degToRad(-90),0, THREE.MathUtils.degToRad(60));
      model.scale.x = model.scale.y = model.scale.z = 1;

      
      
      backdropGroup.clear();
      backdropGroup.add(model);

      // === 2. PARTÍCULA AZUL TITILANTE ===
      const particleGroup = new THREE.Group();
      
      const particleMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x21d6ff, 
        transparent: true, 
        emissive: new THREE.Color(0x21d6ff),
        opacity: 0, 
        depthWrite: false,
      });
      
      const particleMesh = new THREE.Mesh(
        new THREE.SphereGeometry(2, 50, 50), 
        particleMaterial
      );
      const particleLight = new THREE.PointLight(0x00aaff, 5, 2000);
      
      particleGroup.add(particleMesh);
      particleGroup.add(particleLight);
      particleGroup.position.set(-100, -40, 60); // Posición inicial (ajusta si es necesario)
      
      // Agregamos la partícula al modelo para que sus rutas dependan de la escala/posición de la montaña
      model.add(particleGroup);
      

      // Puntos iniciales para que la partícula suba (relativos al modelo)
      const pathPoints = [
        new THREE.Vector3(-100, -40, -60),        // Inicio (abajo)
        new THREE.Vector3(-25, -60, -30),     // Avance 1
        new THREE.Vector3(-40, 5, 5),      // Avance 2
        new THREE.Vector3(-7, -20, 35),     // Avance 3
        new THREE.Vector3(-10, 20, 60),     // Avance 4
        new THREE.Vector3(10, 30, 100),       // Cima
        new THREE.Vector3(10, 30, 100),       // Cima
      ];

      particleGroup.position.copy(pathPoints[0]);

      climbTimeline?.kill();
      climbTimeline = gsap.timeline({ repeat: -1 });
      for (let i = 0; i < pathPoints.length; i++) {
        climbTimeline.to(particleGroup.position, {
          x: pathPoints[i].x,
          y: pathPoints[i].y,
          z: pathPoints[i].z,
          duration: 1,
          ease: 'power4.inOut'
        });
      }

      // Animación titilante (brillo/halo)
      blinkTimeline?.kill();
      blinkTimeline = gsap.timeline({ repeat: -1, yoyo: true });
      const particleScaleMax = 2;
      const particleBaseScale = 0.2;
      blinkTimeline.fromTo(particleMesh.scale, { x: particleBaseScale, y: particleBaseScale, z: particleBaseScale }, { x: particleScaleMax, y: particleScaleMax, z: particleScaleMax, duration: 0.2 }, 0);
      blinkTimeline.fromTo(particleLight, { intensity: 0.2 }, { intensity: 1, duration: 0.2 }, 0);


      loopTimeline?.kill();
      
      backdropGroup.rotation.set(0,0, 0);

      materials.push(particleMaterial);

      return materials;
    },
    onShow: () => {
      loopTimeline?.resume();
      climbTimeline?.resume();
      blinkTimeline?.resume();
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
      loopTimeline?.pause();
      climbTimeline?.pause();
      blinkTimeline?.pause();
      if (collectedMaterials && collectedMaterials.length) {
        collectedMaterials.forEach((m) => {
          try {
            (m as any).depthWrite = false;
            m.needsUpdate = true;
          } catch (e) {}
        });
      }
    },
    update: () => {
      // Animation is timeline-driven.
    },
    dispose: () => {
      loopTimeline?.kill();
      loopTimeline = null;
      climbTimeline?.kill();
      climbTimeline = null;
      blinkTimeline?.kill();
      blinkTimeline = null;
      collectedMaterials = [];
    },
  };
};
