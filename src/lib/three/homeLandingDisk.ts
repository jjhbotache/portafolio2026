import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import gsap from 'gsap';

const NEON_PART_INDEXES = new Set([0, 3]);

const createDiskMaterials = () => {
  const darkDiskMaterial = new THREE.MeshStandardMaterial({
    color: 0x787878,
    metalness: 1,
    roughness: 0,
    // envMapIntensity: 0,
  });

  const neonDiskMaterial = new THREE.MeshStandardMaterial({
    color: 0x68d9ff,
    emissive: 0x68d9ff,
    emissiveIntensity: 0.2,
    roughness: 0.8,
    metalness: 0.2,
  });

  return { darkDiskMaterial, neonDiskMaterial };
};

const splitGeometryIntoComponents = (geometry: THREE.BufferGeometry) => {
  geometry.computeVertexNormals();

  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const posAttr = nonIndexed.getAttribute('position');
  const positions = posAttr.array as Float32Array;
  const faceCount = positions.length / 9;

  const vertToFaces = new Map<string, number[]>();
  const faceVertexKeys: string[][] = [];

  const vertexKey = (x: number, y: number, z: number) => `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;

  for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
    const base = faceIndex * 9;
    const keys: string[] = [];

    for (let vertexIndex = 0; vertexIndex < 3; vertexIndex++) {
      const x = positions[base + vertexIndex * 3 + 0];
      const y = positions[base + vertexIndex * 3 + 1];
      const z = positions[base + vertexIndex * 3 + 2];
      const key = vertexKey(x, y, z);

      keys.push(key);

      const linkedFaces = vertToFaces.get(key) || [];
      linkedFaces.push(faceIndex);
      vertToFaces.set(key, linkedFaces);
    }

    faceVertexKeys.push(keys);
  }

  const neighbors: number[][] = Array.from({ length: faceCount }, () => []);

  for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
    const keys = faceVertexKeys[faceIndex];
    const neighSet = new Set<number>();

    for (const key of keys) {
      const faces = vertToFaces.get(key) || [];
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

    const stack = [faceIndex];
    const componentFaces: number[] = [];
    visited[faceIndex] = 1;

    while (stack.length > 0) {
      const currentFace = stack.pop() as number;
      componentFaces.push(currentFace);

      for (const neighbor of neighbors[currentFace]) {
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

const buildComponentGeometry = (componentFaces: number[], positions: Float32Array) => {
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
  geometry.computeVertexNormals();

  return geometry;
};

const assignMaterialByPart = (
  partIndex: number,
  neonDiskMaterial: THREE.MeshStandardMaterial,
  darkDiskMaterial: THREE.MeshStandardMaterial,
) => {
  if (NEON_PART_INDEXES.has(partIndex)) {
    return neonDiskMaterial;
  }

  return darkDiskMaterial;
};

const applyDiskWobbleAnimation = (diskGroup: THREE.Mesh) => {
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

  gsap.to(diskGroup.rotation, {
    keyframes,
    duration: 6,
    ease: 'none',
    repeat: -1,
  });
};

export const loadLandingDisk = (diskRoot: THREE.Group) => {
  const { darkDiskMaterial, neonDiskMaterial } = createDiskMaterials();
  const stlLoader = new STLLoader();

  

  stlLoader.load('/3d/disk.stl', (geometry) => {
    const { components, positions } = splitGeometryIntoComponents(geometry);

    components.forEach((componentFaces, partIndex) => {
      const componentGeometry = buildComponentGeometry(componentFaces, positions);
      const material = assignMaterialByPart(partIndex, neonDiskMaterial, darkDiskMaterial);
      const mesh = new THREE.Mesh(componentGeometry, material);
      applyDiskWobbleAnimation(mesh);
      diskRoot.add(mesh);
    });
  });
};
