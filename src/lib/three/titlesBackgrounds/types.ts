import * as THREE from 'three';

export type TitleBackgroundLoadContext = {
  sourceModels: THREE.Object3D[];
  sourceAnimations: Map<THREE.Object3D, THREE.AnimationClip[]>;
  backdropGroup: THREE.Group;
  titleSize: THREE.Vector3;
};

export type TitleBackgroundUpdateContext = {
  elapsedTime: number;
  camera: THREE.PerspectiveCamera;
  titleQuaternion: THREE.Quaternion;
};

export type TitleBackgroundController = {
  modelPaths: readonly string[];
  onLoad: (context: TitleBackgroundLoadContext) => THREE.Material[];
  onShow: () => void;
  onHide: () => void;
  update: (context: TitleBackgroundUpdateContext) => void;
  dispose: () => void;
};
