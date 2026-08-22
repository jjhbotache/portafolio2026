import * as THREE from 'three';

// Module-level LoadingManager shared by every texture fetch below. The
// promise it backs (`texturesReady`) is consumed by the landing
// orchestrator to freeze scroll until every PBR texture the platform
// and the floor depend on has actually decoded. Without it the mask
// shrink and the space intro can run with the materials still showing
// as flat color (or fully black) on a cold cache, because
// `THREE.TextureLoader` resolves its callback without waiting for the
// underlying `Image` to finish decoding.
const loadingManager = new THREE.LoadingManager();
const textureLoader = new THREE.TextureLoader(loadingManager);

let resolveTexturesReady!: () => void;
const texturesReady = new Promise<void>((resolve) => {
  resolveTexturesReady = resolve;
});

loadingManager.onLoad = () => {
  resolveTexturesReady();
};
loadingManager.onError = (url) => {
  // Resolve anyway so a single failed texture doesn't strand the page
  // in a frozen scroll state. The material just renders flat-colored.
  console.warn('[landing textures] failed to load:', url);
  resolveTexturesReady();
};

const textures = {
  metal: {
    map: textureLoader.load('/3d/textures/metal/Metal029_1K-JPG_Color.jpg'),
    displacementMap: textureLoader.load('/3d/textures/metal/Metal029_1K-JPG_Displacement.jpg'),
    metalnessMap: textureLoader.load('/3d/textures/metal/Metal029_1K-JPG_Metalness.jpg'),
    normalMap: textureLoader.load('/3d/textures/metal/Metal029_1K-JPG_NormalGL.jpg'),
    roughnessMap: textureLoader.load('/3d/textures/metal/Metal029_1K-JPG_Roughness.jpg'),
  }
};

textures.metal.map.colorSpace = THREE.SRGBColorSpace;

let maxAnisotropy = 1;
export const configureMaterialAnisotropy = (renderer: THREE.WebGLRenderer) => {
  maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  textures.metal.map.anisotropy = maxAnisotropy;
  textures.metal.normalMap.anisotropy = maxAnisotropy;
};

export const addPlanarUvs = (geometry: THREE.BufferGeometry) => {
  geometry.computeBoundingBox();
  const boundingBox = geometry.boundingBox;
  const positionAttribute = geometry.getAttribute('position');

  if (!boundingBox || !positionAttribute) {
    return;
  }

  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  const axisSizes = [
    { axis: 'x' as const, size: size.x },
    { axis: 'y' as const, size: size.y },
    { axis: 'z' as const, size: size.z },
  ].sort((a, b) => b.size - a.size);

  const uAxis = axisSizes[0].axis;
  const vAxis = axisSizes[1].axis;
  const min = boundingBox.min;
  const max = boundingBox.max;
  const uSpan = Math.max(max[uAxis] - min[uAxis], Number.EPSILON);
  const vSpan = Math.max(max[vAxis] - min[vAxis], Number.EPSILON);
  const uvArray = new Float32Array(positionAttribute.count * 2);

  for (let i = 0; i < positionAttribute.count; i++) {
    const x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);
    const z = positionAttribute.getZ(i);
    const vertex = { x, y, z };

    uvArray[i * 2] = (vertex[uAxis] - min[uAxis]) / uSpan;
    uvArray[i * 2 + 1] = (vertex[vAxis] - min[vAxis]) / vSpan;
  }

  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvArray, 2));
};




export type MaterialName =
  | 'diskDark'
  | 'diskNeon'
  | 'platformDark'
  | 'platformNeon'
  | 'floorDark'
  | 'floorNeon';

const getBaseMaterialParams = (materialName: MaterialName): THREE.MeshStandardMaterialParameters => {
  if (materialName === 'diskDark') {
    return {
      color: 0x090909,
      metalness: 1,
      roughness: .4
      
    };
  }

  if (materialName === 'diskNeon') {
    return {
      color: 0x68d9ff,
      emissive: 0x68d9ff,
      emissiveIntensity: 0.2,
      roughness: 0.8,
      metalness: 0.2,
      opacity: 1
    };
  }

  if (materialName === 'platformDark') {
    return {
      ...textures.metal,
      color: 0xffffff,
      displacementScale: 0.02,
      metalness: 1,
      roughness: .8,
    };
  }

  if (materialName === 'floorDark') {
    return {
      ...textures.metal,
      color: 0x000000,
      displacementScale: 0.09,
      metalness: 0.1,
      roughness: 0,
    };
  }

  if (materialName === 'platformNeon' || materialName === 'floorNeon') {
    return {
      color: 0xff1fe5,
      emissive: 0x68d9ff,
      emissiveIntensity: 0.001,
      roughness: 0.8,
      metalness: 0.5,
    };
  }

  return {
    color: 0xff1fe5,
    emissive: 0x68d9ff,
    emissiveIntensity: 0.04,
    roughness: 0.8,
    metalness: 0.2,
  };
};

export { texturesReady };

export const clearLandingMaterialCache = () => {
  materialCache.forEach((material) => material.dispose());
  materialCache.clear();
};

// Cached materials: one MeshStandardMaterial per name.
// Reusing the same material across meshes enables GPU batching and reduces memory.
const materialCache = new Map<MaterialName, THREE.MeshStandardMaterial>();

export const materialFactory = (materialName: MaterialName): THREE.MeshStandardMaterial => {
  const cached = materialCache.get(materialName);
  if (cached) {
    return cached;
  }

  const material = new THREE.MeshStandardMaterial(getBaseMaterialParams(materialName));
  materialCache.set(materialName, material);
  return material;
};

export const getLandingMaterial = materialFactory;

export const disposeAllTextures = () => {
  textures.metal.map.dispose();
  textures.metal.normalMap.dispose();
};
