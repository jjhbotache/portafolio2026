import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import gsap from 'gsap';
import { materialFactory } from './materialFactory';
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

// Module-level cache for parsed STL geometries. Both `preloadLandingEnvironment`
// and `loadLandingEnvironment` share this cache so the heavy geometry parsing
// happens only once, even when the user reloads the scene (e.g. on language
// toggle).
const stlGeometryCache = new Map<string, THREE.BufferGeometry>();

const fetchStlGeometry = (loader: STLLoader, filePath: string): Promise<THREE.BufferGeometry> => {
  return new Promise((resolve) => {
    const cached = stlGeometryCache.get(filePath);
    if (cached) {
      resolve(cached);
      return;
    }
    loader.load(filePath, (geometry) => {
      stlGeometryCache.set(filePath, geometry);
      resolve(geometry);
    });
  });
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

const loadCompositeStl = (
  loader: STLLoader,
  filePath: string,
  targetRoot: THREE.Group,
  neonIndexes: Set<number>,
  neonMaterialName: 'platformNeon' | 'floorNeon',
  darkMaterialName: 'platformDark' | 'floorDark',
) => {
  loader.load(filePath, (geometry) => {
    buildPlatformFromGeometry(geometry, targetRoot, neonIndexes, neonMaterialName, darkMaterialName);
  });
};

const calculateFloorTileSpacing = (geometry: THREE.BufferGeometry) => {
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

const createFloorGrid = (loader: STLLoader, scene: THREE.Scene) => {
  loader.load('/3d/floor.stl', (geometry) => {
    buildFloorGridFromGeometry(geometry, scene);
  });
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
  const starCount = 500;
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
  const loader = new STLLoader();

  const platformRoot = new THREE.Group();
  platformRoot.scale.set(0.21, 0.21, 0.21);
  platformRoot.rotation.set(THREE.MathUtils.degToRad(270), 0, 0);
  platformRoot.position.set(0, -3, 0);
  scene.add(platformRoot);
  // Use the cached geometry when `preloadLandingEnvironment` already kicked
  // off the fetch — the parsed BufferGeometry is reused as-is and we skip the
  // HTTP request and STL parsing entirely.
  
  const cachedPlatform = stlGeometryCache.get('/3d/platform.stl');
  if (cachedPlatform) {
    buildPlatformFromGeometry(
      cachedPlatform,
      platformRoot,
      PLATFORM_NEON_PART_INDEXES,
      'platformNeon',
      'platformDark',
    );
  } else {
    loadCompositeStl(
      loader,
      '/3d/platform.stl',
      platformRoot,
      PLATFORM_NEON_PART_INDEXES,
      'platformNeon',
      'platformDark',
    );
  }
  

  // const cachedFloor = stlGeometryCache.get('/3d/floor.stl');
  // if (cachedFloor) {
  //   buildFloorGridFromGeometry(cachedFloor, scene);
  // } else {
  //   createFloorGrid(loader, scene);
  // }
};

// Kick off the STL fetches early so the parsed geometries are ready by the
// time `loadLandingEnvironment` is invoked. Called from `buildLandingTimeline`
// the moment the user starts scrolling, instead of waiting until the scene
// is fully constructed. The shared `stlGeometryCache` makes the second
// load effectively instant. Returns a promise that resolves once both fetches
// (or cache lookups) complete so the caller can `await` for back-pressure.
export const preloadLandingEnvironment = (): Promise<void> => {
  const loader = new STLLoader();
  return Promise.all([
    fetchStlGeometry(loader, '/3d/platform.stl'),
    fetchStlGeometry(loader, '/3d/floor.stl'),
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
