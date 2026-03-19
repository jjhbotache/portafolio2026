import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

const PLATFORM_NEON_PART_INDEXES = new Set([1]);
const FLOOR_NEON_PART_INDEXES = new Set([0]);
const FLOOR_SCALE = 0.3;
const FLOOR_Y = -6;
const FLOOR_ROTATION_X = THREE.MathUtils.degToRad(270);

const createEnvironmentMaterials = () => {
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    metalness: 1,
    roughness: 0,
  });

  const neonMaterial = new THREE.MeshStandardMaterial({
    color: 0xff1fe5,
    emissive: 0x68d9ff,
    emissiveIntensity: 0.04,
    roughness: 0.8,
    metalness: 0.2,
  });

  return { darkMaterial, neonMaterial };
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
  neonIndexes: Set<number>,
  neonMaterial: THREE.MeshStandardMaterial,
  darkMaterial: THREE.MeshStandardMaterial,
) => {
  if (neonIndexes.has(partIndex)) {
    return neonMaterial;
  }

  return darkMaterial;
};

const loadCompositeStl = (
  loader: STLLoader,
  filePath: string,
  targetRoot: THREE.Group,
  neonIndexes: Set<number>,
) => {
  const { darkMaterial, neonMaterial } = createEnvironmentMaterials();

  loader.load(filePath, (geometry) => {
    const { components, positions } = splitGeometryIntoComponents(geometry);

    components.forEach((componentFaces, partIndex) => {
      const componentGeometry = buildComponentGeometry(componentFaces, positions);
      const material = assignMaterialByPart(partIndex, neonIndexes, neonMaterial, darkMaterial);
      const mesh = new THREE.Mesh(componentGeometry, material);
      targetRoot.add(mesh);
    });
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

const createFloorGrid = (loader: STLLoader, scene: THREE.Scene) => {
  const { darkMaterial, neonMaterial } = createEnvironmentMaterials();

  loader.load('/3d/floor.stl', (geometry) => {
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
          const material = assignMaterialByPart(partIndex, FLOOR_NEON_PART_INDEXES, neonMaterial, darkMaterial);
          const mesh = new THREE.Mesh(componentGeometry, material);
          floorRoot.add(mesh);
        });
      }
    }
  });
};

export const loadLandingEnvironment = (scene: THREE.Scene) => {
  const loader = new STLLoader();

  const platformRoot = new THREE.Group();
  platformRoot.scale.set(0.21, 0.21, 0.21);
  platformRoot.rotation.set(THREE.MathUtils.degToRad(270), 0, 0);
  platformRoot.position.set(0, -3, 0);
  scene.add(platformRoot);

  loadCompositeStl(loader, '/3d/platform.stl', platformRoot, PLATFORM_NEON_PART_INDEXES);
  createFloorGrid(loader, scene);
};
