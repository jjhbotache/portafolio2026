import * as THREE from 'three';

const BACKDROP_SCALE_FACTOR = 1.7;
const BACKDROP_MIN_HEIGHT = 8;
const BACKDROP_MIN_DEPTH_OFFSET = 20;

type PlaceBackdropOptions = {
  xOffset?: number;
  yOffset?: number;
  zOffset?: number;
  scaleFactor?: number;
  minHeight?: number;
  minDepthOffset?: number;
};

const prepareBackdropMaterial = (material: THREE.MeshStandardMaterial) => {
  material.transparent = true;
  // material.opacity = 0;
  material.depthWrite = false;
};

export const cloneBackdropModel = (
  sourceModel: THREE.Object3D,
  customizeMaterial?: (material: THREE.MeshStandardMaterial) => void,
) => {
  const backdropModel = sourceModel.clone(true);
  const backdropMaterials: THREE.Material[] = [];

  backdropModel.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.geometry = child.geometry.clone();

    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => {
        const cloned = material.clone();
        prepareBackdropMaterial(cloned);
        customizeMaterial?.(cloned);
        backdropMaterials.push(cloned);
        return cloned;
      });
      return;
    }

    const clonedMaterial = child.material.clone();
    prepareBackdropMaterial(clonedMaterial);
    customizeMaterial?.(clonedMaterial);
    child.material = clonedMaterial;
    backdropMaterials.push(clonedMaterial);
  });

  return {
    model: backdropModel,
    materials: backdropMaterials,
  };
};

export const placeBackdropBehindTitle = (
  model: THREE.Object3D,
  titleSize: THREE.Vector3,
  options: PlaceBackdropOptions = {},
) => {
  const modelBounds = new THREE.Box3().setFromObject(model);
  const modelSize = new THREE.Vector3();
  const modelCenter = new THREE.Vector3();
  modelBounds.getSize(modelSize);
  modelBounds.getCenter(modelCenter);

  const scaleFactor = options.scaleFactor ?? BACKDROP_SCALE_FACTOR;
  const minHeight = options.minHeight ?? BACKDROP_MIN_HEIGHT;
  const minDepthOffset = options.minDepthOffset ?? BACKDROP_MIN_DEPTH_OFFSET;
  const modelHeight = Math.max(modelSize.y, Number.EPSILON);
  const targetHeight = Math.max(titleSize.y * scaleFactor, minHeight);
  const scale = targetHeight / modelHeight;

  model.scale.setScalar(scale);
  model.position.set(-modelCenter.x * scale, -modelCenter.y * scale, -modelCenter.z * scale);

  const scaledDepth = modelSize.z * scale;
  const depthOffset = Math.max(
    titleSize.z * 0.5 + scaledDepth * 0.5 + minDepthOffset,
    minDepthOffset,
  );

  model.position.z -= depthOffset;
  model.position.x += options.xOffset ?? 0;
  model.position.y += options.yOffset ?? 0;
  model.position.z += options.zOffset ?? 0;
};

export const setMaterialColor = (material: THREE.Material, color: number) => {
  const colorMaterial = material as THREE.Material & { color?: THREE.Color };
  if (colorMaterial.color) {
    colorMaterial.color.set(color);
  }
};
