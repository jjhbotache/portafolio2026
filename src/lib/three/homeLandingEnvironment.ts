import * as THREE from 'three';
import gsap from 'gsap';
import { materialFactory } from './materialFactory';
import { fetchCachedStl } from './modelCache';
import {
  splitGeometryIntoComponents,
  buildComponentGeometry,
} from './stlComponentSplitter';

const PLATFORM_NEON_PART_INDEXES = new Set([1]);
const FLOOR_NEON_PART_INDEXES = new Set([0]);
const FLOOR_SCALE = 0.3;
const FLOOR_Y = -6;
const FLOOR_ROTATION_X = THREE.MathUtils.degToRad(270);

// Module-level env materials for fading the floor/platform
let envMaterials: THREE.Material[] = [];

// Resolve a cached STL geometry and unwrap it without re-running the STL
// parse. Returns `null` only when the cache lookup somehow throws (the
// underlying cache is in-memory so this should never happen).
const fetchStlGeometry = async (filePath: string): Promise<THREE.BufferGeometry> => {
  return fetchCachedStl(filePath);
};

const buildPlatformFromGeometry = (
  geometry: THREE.BufferGeometry,
  targetRoot: THREE.Group,
  neonIndexes: Set<number>,
  neonMaterialName: 'platformNeon' | 'floorNeon',
  darkMaterialName: 'platformDark' | 'floorDark',
) => {
  const { components, positions } = splitGeometryIntoComponents(geometry);

  components.forEach((componentFaces, partIndex) => {
    const componentGeometry = buildComponentGeometry(componentFaces, positions);
    const materialName = neonIndexes.has(partIndex) ? neonMaterialName : darkMaterialName;
    const mat = materialFactory(materialName) as THREE.Material & { opacity?: number; transparent?: boolean };
    mat.transparent = true;
    if (typeof (mat as any).opacity === 'undefined') (mat as any).opacity = 1;
    const mesh = new THREE.Mesh(componentGeometry, mat);
    envMaterials.push(mat);
    targetRoot.add(mesh);
  });
};

const calculateFloorTileSpacing = (geometry: THREE.BufferGeometry) => {
  // `fetchCachedStl` already computes the bounding box when the geometry
  // is first parsed, so this is a guaranteed cache hit on the second call.
  geometry.computeBoundingBox();

  const boundingBox = geometry.boundingBox;
  if (!boundingBox) {
    return { x: 0, z: 0 };
  }

  const transformedBox = boundingBox.clone();
  const transform = new THREE.Matrix4()
    .makeRotationX(FLOOR_ROTATION_X)
    .scale(new THREE.Vector3(FLOOR_SCALE, FLOOR_SCALE, FLOOR_SCALE));

  transformedBox.applyMatrix4(transform);

  const size = new THREE.Vector3();
  transformedBox.getSize(size);

  return { x: size.x, z: size.z };
};

const buildFloorGridFromGeometry = (geometry: THREE.BufferGeometry, scene: THREE.Scene) => {
  const { components, positions } = splitGeometryIntoComponents(geometry);
  const componentGeometries = components.map((componentFaces) =>
    buildComponentGeometry(componentFaces, positions),
  );

  const { x: spacingX, z: spacingZ } = calculateFloorTileSpacing(geometry);

  for (let gridX = -1; gridX <= 1; gridX++) {
    for (let gridZ = -1; gridZ <= 1; gridZ++) {
      const floorRoot = new THREE.Group();
      floorRoot.scale.set(FLOOR_SCALE, FLOOR_SCALE, FLOOR_SCALE);
      floorRoot.rotation.set(FLOOR_ROTATION_X, 0, 0);
      floorRoot.position.set(gridX * spacingX, FLOOR_Y, gridZ * spacingZ);
      scene.add(floorRoot);

      componentGeometries.forEach((componentGeometry, partIndex) => {
        const isNeonPart = FLOOR_NEON_PART_INDEXES.has(partIndex);
        const materialName = isNeonPart ? 'floorNeon' : 'floorDark';
        const mat = materialFactory(materialName) as THREE.Material & { opacity?: number; transparent?: boolean };
        mat.transparent = true;
        if (typeof (mat as any).opacity === 'undefined') (mat as any).opacity = 1;
        const mesh = new THREE.Mesh(componentGeometry, mat);
        envMaterials.push(mat);
        floorRoot.add(mesh);
      });
    }
  }
};

export const fadeOutFloor = (duration = 0.5) => {
  if (!envMaterials.length) return null;
  // dep
  return gsap.to(envMaterials, { opacity: 0, depthWrite: false,needsUpdate: true, duration, ease: 'power2.inOut' });
};

export const fadeInFloor = (duration = 0.5) => {
  if (!envMaterials.length) return null;
  return gsap.to(envMaterials, { opacity: 1, depthWrite: true,needsUpdate: true, duration, ease: 'power2.inOut' });
};


export const createLandingStarField = () => {
  const starsGeometry = new THREE.BufferGeometry();
  // 300 stars is enough to read as a dense sky from the camera distance
  // we orbit at; the previous 500 cost extra vertex/fragment work for no
  // visible gain (the extra points are below the bloom threshold).
  const starCount = 300;
  const minDistanceFromCenter = 10;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i += 1) {
    const i3 = i * 3;
    let x = 0;
    let y = 0;
    let z = 0;

    // Keep stars outside a minimum radius from the scene center.
    do {
      x = THREE.MathUtils.randFloatSpread(120);
      y = THREE.MathUtils.randFloatSpread(80);
      z = THREE.MathUtils.randFloatSpread(120);
    } while (Math.sqrt(x * x + y * y + z * z) < minDistanceFromCenter);

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
  }

  starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const starsMaterial = new THREE.PointsMaterial({
    color: 0xd9ecff,
    size: 0.15,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    depthWrite: false,
  });

  const starField = new THREE.Points(starsGeometry, starsMaterial);

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    starField,
    animate: (elapsedTime: number) => {
      // Respect prefers-reduced-motion by freezing the starfield animation.
      if (reducedMotion) {
        return;
      }
      // Very subtle movement to keep a calm sky feeling.
      starField.rotation.y = elapsedTime * 0.008;
      starField.rotation.x = Math.sin(elapsedTime * 0.05) * 0.01;
      starsMaterial.opacity = 0.82 + Math.sin(elapsedTime * 0.4) * 0.08;
    },
    dispose: () => {
      starsGeometry.dispose();
      starsMaterial.dispose();
    },
  };
};

export const loadLandingEnvironment = (scene: THREE.Scene) => {
  const platformRoot = new THREE.Group();
  platformRoot.scale.set(0.21, 0.21, 0.21);
  platformRoot.rotation.set(THREE.MathUtils.degToRad(270), 0, 0);
  platformRoot.position.set(0, -3, 0);
  scene.add(platformRoot);

  // The geometries are preloaded via `preloadLandingEnvironment()` (awaited
  // by the caller), so the cache lookup below is synchronous and free of
  // network/parse cost. Fall back to an async fetch if for some reason the
  // preload step was skipped.
  const cachedPromise = fetchCachedStl('/3d/platform.stl');
  cachedPromise.then((geometry) => {
    // Guard against double-attach if `loadLandingEnvironment` is called
    // more than once on the same scene (e.g. on SPA re-init without the
    // old scene being disposed yet).
    if (platformRoot.children.length > 0) {
      return;
    }
    buildPlatformFromGeometry(
      geometry,
      platformRoot,
      PLATFORM_NEON_PART_INDEXES,
      'platformNeon',
      'platformDark',
    );
  });
};

// Kick off the STL fetches early so the parsed geometries are ready by the
// time `loadLandingEnvironment` is invoked. Called from `buildLandingTimeline`
// the moment the user starts scrolling, instead of waiting until the scene
// is fully constructed. The shared model cache makes the second load
// effectively instant. Returns a promise that resolves once both fetches
// (or cache lookups) complete so the caller can `await` for back-pressure.
export const preloadLandingEnvironment = (): Promise<void> => {
  return Promise.all([
    fetchStlGeometry('/3d/platform.stl'),
    fetchStlGeometry('/3d/floor.stl'),
  ]).then(() => undefined);
};

let envRoot: THREE.Group | null = null;
let envStarFieldDispose: (() => void) | null = null;

export const disposeLandingEnvironment = () => {
  if (envRoot) {
    envRoot.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
    envRoot = null;
  }
  envStarFieldDispose?.();
  envStarFieldDispose = null;
  envMaterials = [];
};
