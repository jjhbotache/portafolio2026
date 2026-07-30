// Module-level cache for parsed 3D assets.
//
// Background:
// - The landing scene is created on every SPA navigation (Astro view
//   transitions). Without this cache each re-init re-downloads every
//   STL/GLTF even though the files never change, which is what produced
//   the 4× duplicate fetches visible in the Network panel.
// - `BufferGeometry` is immutable from the renderer's point of view, so it
//   is safe to share between scenes. Callers that need a private copy must
//   `clone()` it themselves.
// - For GLTF we cache the entire parsed object (scene + animations). The
//   caller is expected to clone() the scene before adding it to its own
//   Object3D graph, otherwise two scenes would share the same root.
//
// Memory: a single STL can be 30+ MB on the GPU once uploaded, but the JS
// `BufferGeometry` heap cost is small (raw Float32Arrays). GLTF caches
// hold the parsed scene graph + textures; dispose via `clearModelCache()`
// if you need to release VRAM.

import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type CachedGltf = {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
};

const stlLoader = new STLLoader();
const gltfLoader = new GLTFLoader();

// Pending + resolved promises keyed by URL. We store the Promise (not the
// resolved value) so concurrent callers dedupe onto the same in-flight
// fetch instead of kicking off parallel requests for the same file.
const stlCache = new Map<string, Promise<THREE.BufferGeometry>>();
const gltfCache = new Map<string, Promise<CachedGltf>>();

export const fetchCachedStl = (filePath: string): Promise<THREE.BufferGeometry> => {
  let pending = stlCache.get(filePath);
  if (pending) {
    return pending;
  }

  pending = new Promise<THREE.BufferGeometry>((resolve, reject) => {
    stlLoader.load(
      filePath,
      (geometry) => {
        // Pre-compute the bounding box once: every caller that scales or
        // centres the geometry needs it, and it's cheap relative to the
        // parse cost. Skipping it forces N boxes to be computed later.
        geometry.computeBoundingBox();
        resolve(geometry);
      },
      undefined,
      (err) => reject(err),
    );
  });

  stlCache.set(filePath, pending);
  return pending;
};

export const fetchCachedGltf = (filePath: string): Promise<CachedGltf> => {
  let pending = gltfCache.get(filePath);
  if (pending) {
    return pending;
  }

  pending = gltfLoader.loadAsync(filePath).then((gltf) => ({
    scene: gltf.scene,
    animations: gltf.animations ?? [],
  }));

  gltfCache.set(filePath, pending);
  return pending;
};

// Synchronous lookup: returns `true` if the geometry has already been
// resolved and cached. Useful when you want to skip the await entirely on
// hot paths (e.g. reusing an already-loaded disk).
export const hasCachedStl = (filePath: string): boolean => {
  const pending = stlCache.get(filePath);
  // We can't tell from a Promise alone whether it's settled, so this is a
  // best-effort hint. Callers that need the exact value should still
  // `await fetchCachedStl`.
  return pending !== undefined;
};

export const clearModelCache = (): void => {
  stlCache.clear();
  gltfCache.clear();
};