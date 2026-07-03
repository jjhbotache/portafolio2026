import * as THREE from 'three';

export type TitleBackgroundLoadContext = {
  sourceModels: THREE.Object3D[];
  sourceAnimations: Map<THREE.Object3D, THREE.AnimationClip[]>;
  backdropGroup: THREE.Group;
  // Root group owned by the title manager that controls the backdrop's overall
  // visibility. The background must place its content inside this group (or
  // a child of it) so we can flip `visible = false` once the fade-out
  // completes without losing the option to flip it back to `true` later.
  backdropRoot: THREE.Group;
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
  /**
   * Optional callback fired once the background has finished hiding
   * (including any fade-out animations). Implementations with a tween
   * should defer the call until the tween completes; synchronous hides can
   * invoke it directly. The landing scene uses this to flip the backdrop
   * root's `visible` flag so hidden content stops being drawn.
   */
  onHidden?: () => void;
};
