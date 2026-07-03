import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import gsap from 'gsap';
import { addPlanarUvs, materialFactory } from './materialFactory';
import {
  splitGeometryIntoComponents,
  buildComponentGeometry,
} from './stlComponentSplitter';

const NEON_PART_INDEXES = new Set([0, 3]);

// Module-level references so we can fade the disk materials later
let diskMaterials: THREE.Material[] = [];
let diskRootRef: THREE.Group | null = null;
let diskWobbleTween: gsap.core.Tween | null = null;

const applyDiskWobbleAnimation = (diskGroup: THREE.Mesh) => {
  // Respect prefers-reduced-motion: skip the continuous wobble.
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    diskGroup.rotation.x = THREE.MathUtils.degToRad(5);
    diskGroup.rotation.y = 0;
    return;
  }

  const diskRotation = THREE.MathUtils.degToRad(5);
  const totalPoints = 20;
  const keyframes: Array<{ x: number; y: number }> = [];

  for (let i = 1; i <= totalPoints; i++) {
    const angle = (2 * Math.PI * i) / totalPoints;
    keyframes.push({
      x: Math.cos(angle) * diskRotation,
      y: Math.sin(angle) * diskRotation,
    });
  }

  diskGroup.rotation.x = diskRotation;
  diskGroup.rotation.y = 0;

  diskWobbleTween = gsap.to(diskGroup.rotation, {
    keyframes,
    duration: 6,
    ease: 'none',
    repeat: -1,
  });
};

export const loadLandingDisk = (diskRoot: THREE.Group) => {
  diskRootRef = diskRoot;
  const stlLoader = new STLLoader();

  stlLoader.load('/3d/disk.stl', (geometry) => {
    const { components, positions } = splitGeometryIntoComponents(geometry);

    components.forEach((componentFaces, partIndex) => {
      const componentGeometry = buildComponentGeometry(componentFaces, positions);
      const materialName = NEON_PART_INDEXES.has(partIndex) ? 'diskNeon' : 'diskDark';
      addPlanarUvs(componentGeometry);

      const mat = materialFactory(materialName) as THREE.Material & { opacity?: number; transparent?: boolean };
      mat.transparent = true;
      if (typeof (mat as any).opacity === 'undefined') (mat as any).opacity = 1;

      const mesh = new THREE.Mesh(componentGeometry, mat);
      diskMaterials.push(mat);
      applyDiskWobbleAnimation(mesh);
      diskRoot.add(mesh);
    });
  });
};

export const fadeOutDisk = (duration = 0.5) => {
  if (!diskMaterials.length) return null;
  return gsap.to(diskMaterials, { opacity: 0, depthWrite: false,needsUpdate: true, duration, ease: 'power2.inOut' });
};

export const fadeInDisk = (duration = 0.5) => {
  if (!diskMaterials.length) return null;
  return gsap.to(diskMaterials, { opacity: 1, depthWrite: true,needsUpdate: true, duration, ease: 'power2.inOut' });
};

export const disposeLandingDisk = () => {
  diskWobbleTween?.kill();
  diskWobbleTween = null;
  if (diskRootRef) {
    diskRootRef.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
  }
  diskMaterials = [];
  diskRootRef = null;
};
