import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();
const textures = {
  metal: {
    map: textureLoader.load('/3d/textures/metal/Metal029_1K-JPG_Color.jpg'),
    displacementMap: textureLoader.load('/3d/textures/metal/Metal029_1K-JPG_Displacement.jpg'),
    metalnessMap: textureLoader.load('/3d/textures/metal/Metal029_1K-JPG_Metalness.jpg'),
    normalMap: textureLoader.load('/3d/textures/metal/Metal029_1K-JPG_NormalGL.jpg'),
    roughnessMap: textureLoader.load('/3d/textures/metal/Metal029_1K-JPG_Roughness.jpg'),
  },
  rocks: {
    map: textureLoader.load('/3d/textures/rocks/Rocks014_1K-JPG_Color.jpg'),
    displacementMap: textureLoader.load('/3d/textures/rocks/Rocks014_1K-JPG_Displacement.jpg'),
    normalMap: textureLoader.load('/3d/textures/rocks/Rocks014_1K-JPG_NormalGL.jpg'),
    roughnessMap: textureLoader.load('/3d/textures/rocks/Rocks014_1K-JPG_Roughness.jpg'),
  },
  matteMetal: {
    map: textureLoader.load('/3d/textures/matte_metal/Metal046B_1K-JPG_Color.jpg'),
    displacementMap: textureLoader.load('/3d/textures/matte_metal/Metal046B_1K-JPG_Displacement.jpg'),
    metalnessMap: textureLoader.load('/3d/textures/matte_metal/Metal046B_1K-JPG_Metalness.jpg'),
    normalMap: textureLoader.load('/3d/textures/matte_metal/Metal046B_1K-JPG_NormalGL.jpg'),
    roughnessMap: textureLoader.load('/3d/textures/matte_metal/Metal046B_1K-JPG_Roughness.jpg'),
  },
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

textures.metal.map.colorSpace = THREE.SRGBColorSpace;
textures.rocks.map.colorSpace = THREE.SRGBColorSpace;
textures.matteMetal.map.colorSpace = THREE.SRGBColorSpace;




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

export const clearLandingMaterialCache = () => {
  // No-op: materials are no longer cached.
};

export const materialFactory = (materialName: MaterialName): THREE.MeshStandardMaterial => {
  return new THREE.MeshStandardMaterial(getBaseMaterialParams(materialName));
};

export const getLandingMaterial = materialFactory;
