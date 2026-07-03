import * as THREE from 'three';
import { addPlanarUvs } from './materialFactory';

// Numeric hash (no string allocation per vertex). Quantizes position to
// 1e-4 (0.1mm at 1m) which is enough resolution for human-scale STL assets.
// Primes from the spatial hashing literature reduce hash collisions.
const HASH_PRIME_X = 73856093;
const HASH_PRIME_Y = 19349663;
const HASH_PRIME_Z = 83492791;
const QUANTIZE_SCALE = 1e4;
const QUANTIZE_BIAS = 0.5;

const quantizeAndHash = (x: number, y: number, z: number): number => {
  const ix = Math.round(x * QUANTIZE_SCALE + QUANTIZE_BIAS);
  const iy = Math.round(y * QUANTIZE_SCALE + QUANTIZE_BIAS);
  const iz = Math.round(z * QUANTIZE_SCALE + QUANTIZE_BIAS);
  // 32-bit result; both signed-equivalent and bitwise-equivalent on modern JS.
  return (ix * HASH_PRIME_X) ^ (iy * HASH_PRIME_Y) ^ (iz * HASH_PRIME_Z);
};

type ComponentSplitResult = {
  components: number[][];
  positions: Float32Array;
};

export const splitGeometryIntoComponents = (geometry: THREE.BufferGeometry): ComponentSplitResult => {
  geometry.computeVertexNormals();

  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const posAttr = nonIndexed.getAttribute('position');
  const positions = posAttr.array as Float32Array;
  const faceCount = positions.length / 9;

  // Use a numeric hash keyed Map instead of string-keyed Map to avoid the
  // per-vertex `toFixed(5) + template literal` allocations on every parse.
  const vertToFaces = new Map<number, number[]>();
  const faceVertexKeys: number[][] = [];

  for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
    const base = faceIndex * 9;
    const keys: number[] = [];

    for (let vertexIndex = 0; vertexIndex < 3; vertexIndex++) {
      const x = positions[base + vertexIndex * 3 + 0];
      const y = positions[base + vertexIndex * 3 + 1];
      const z = positions[base + vertexIndex * 3 + 2];
      const key = quantizeAndHash(x, y, z);

      keys.push(key);

      const linkedFaces = vertToFaces.get(key);
      if (linkedFaces) {
        linkedFaces.push(faceIndex);
      } else {
        vertToFaces.set(key, [faceIndex]);
      }
    }

    faceVertexKeys.push(keys);
  }

  const neighbors: number[][] = Array.from({ length: faceCount }, () => []);

  for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
    const keys = faceVertexKeys[faceIndex];
    const neighSet = new Set<number>();

    for (const key of keys) {
      const faces = vertToFaces.get(key);
      if (!faces) continue;
      for (const otherFace of faces) {
        if (otherFace !== faceIndex) {
          neighSet.add(otherFace);
        }
      }
    }

    neighbors[faceIndex] = Array.from(neighSet);
  }

  const visited = new Uint8Array(faceCount);
  const components: number[][] = [];

  for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
    if (visited[faceIndex]) {
      continue;
    }

    const stack: number[] = [faceIndex];
    const componentFaces: number[] = [];
    visited[faceIndex] = 1;

    while (stack.length > 0) {
      const currentFace = stack.pop() as number;
      componentFaces.push(currentFace);

      const faceNeighbors = neighbors[currentFace];
      for (let i = 0; i < faceNeighbors.length; i++) {
        const neighbor = faceNeighbors[i];
        if (!visited[neighbor]) {
          visited[neighbor] = 1;
          stack.push(neighbor);
        }
      }
    }

    components.push(componentFaces);
  }

  return { components, positions };
};

export const buildComponentGeometry = (
  componentFaces: number[],
  positions: Float32Array,
): THREE.BufferGeometry => {
  const outPositions = new Float32Array(componentFaces.length * 9);

  for (let i = 0; i < componentFaces.length; i++) {
    const faceIndex = componentFaces[i];
    const srcBase = faceIndex * 9;
    const dstBase = i * 9;

    for (let j = 0; j < 9; j++) {
      outPositions[dstBase + j] = positions[srcBase + j];
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(outPositions, 3));
  addPlanarUvs(geometry);
  geometry.computeVertexNormals();

  return geometry;
};
