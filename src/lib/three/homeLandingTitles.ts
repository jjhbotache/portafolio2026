import * as THREE from 'three';
import gsap from 'gsap';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { materialFactory } from './materialFactory';
import { createTitleBackgroundControllers } from './titlesBackgrounds';

const TITLE_SEQUENCE = [
  // this order is important, it should match the title background controllers sequence in titlesBackgrounds/index.ts
  '/3d/experiencia.stl',
  '/3d/acerca de mi.stl',
  '/3d/contacto.stl',
  '/3d/proyectos.stl',
] as const;

const ANGLE_PER_TITLE = (Math.PI * 2) / TITLE_SEQUENCE.length;

const normalizeAngle = (angle: number) => {
  const twoPi = Math.PI * 2;
  return ((angle % twoPi) + twoPi) % twoPi;
};

const getNearestTitleIndex = (relativeAngle: number, totalTitles: number) => {
  const normalized = normalizeAngle(relativeAngle);
  return Math.round(normalized / ANGLE_PER_TITLE) % totalTitles;
};

type LandingTitle = {
  group: THREE.Group;
  backdropGroup: THREE.Group;
  materials: THREE.Material[];
  size: THREE.Vector3;
  loaded: boolean;
};

const setTitleOpacity = (title: LandingTitle, opacity: number) => {
  title.materials.forEach((material) => {
    material.opacity = opacity;
  });
};

const loadTitleModel = (
  loader: STLLoader,
  path: string,
  root: THREE.Group,
): LandingTitle => {
  const titleGroup = new THREE.Group();
  const backdropGroup = new THREE.Group();
  titleGroup.add(backdropGroup);

  const title: LandingTitle = {
    group: titleGroup,
    backdropGroup,
    materials: [],
    size: new THREE.Vector3(1, 1, 1),
    loaded: false,
  };

  root.add(titleGroup);

  loader.load(
    path,
    (geometry) => {
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();

      const bounds = geometry.boundingBox;
      if (bounds) {
        bounds.getSize(title.size);
      }

      const material = materialFactory('diskNeon').clone();
      material.transparent = true;
      material.opacity = 0;
      material.depthWrite = false;

      const mesh = new THREE.Mesh(geometry, material);
      titleGroup.add(mesh);
      title.materials.push(material);
      title.loaded = true;
    },
    undefined,
    () => {
      title.loaded = false;
    },
  );

  return title;
};

export const createLandingTitles = (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => {
  const stlLoader = new STLLoader();
  const gltfLoader = new GLTFLoader();
  const backgrounds = createTitleBackgroundControllers();
  const titleWorldPosition = new THREE.Vector3();
  const titlesRootWorldPosition = new THREE.Vector3();
  const cameraLookTarget = new THREE.Vector3();
  const targetQuaternion = new THREE.Quaternion();
  const smoothQuaternion = new THREE.Quaternion();
  const animationsByModel = new Map<THREE.Object3D, THREE.AnimationClip[]>();
  const titlesRoot = new THREE.Group();
  titlesRoot.scale.set(0.03, 0.03, 0.03);
  titlesRoot.rotation.set(0, THREE.MathUtils.degToRad(180), 0);
  titlesRoot.position.set(0, 2.2, 0);

  scene.add(titlesRoot);

  const titles = TITLE_SEQUENCE.map((path) => loadTitleModel(stlLoader, path, titlesRoot));

  if (backgrounds.length !== titles.length) {
    throw new Error('Title backgrounds amount must match title sequence amount.');
  }

  let activeIndex = 0;
  let titlesVisible = false;
  let backdropsLoaded = false;
  let activeTransition: gsap.core.Timeline | null = null;

  const loadBackdrops = async () => {
    const uniqueModelPaths = [...new Set(backgrounds.flatMap((background) => background.modelPaths))];

    if (uniqueModelPaths.length === 0) {
      backdropsLoaded = true;
      if (titlesVisible) {
        showActiveTitle();
        backgrounds[activeIndex].onShow();
        return;
      }

      hideAllTitles();
      return;
    }

    try {
      const loadedEntries = await Promise.all(
        uniqueModelPaths.map(async (path) => {
          const lower = path.toLowerCase();
          if (lower.endsWith('.stl')) {
            return await new Promise<[string, THREE.Object3D]>((resolve, reject) => {
              stlLoader.load(
                path,
                (geometry) => {
                  try {
                    geometry.computeVertexNormals();
                    geometry.computeBoundingBox();
                    const mat = materialFactory('platformDark');
                    const mesh = new THREE.Mesh(geometry, mat);
                    const group = new THREE.Group();
                    group.add(mesh);
                    resolve([path, group]);
                  } catch (err) {
                    reject(err);
                  }
                },
                undefined,
                (err) => reject(err),
              );
            });
          }

          const gltf = await gltfLoader.loadAsync(path);
          if (gltf.animations && gltf.animations.length) {
            animationsByModel.set(gltf.scene, gltf.animations);
          }
          return [path, gltf.scene] as const;
        }),
      );

      const modelByPath = new Map<string, THREE.Object3D>(loadedEntries);

      titles.forEach((title, index) => {
        const sourceModels = backgrounds[index].modelPaths.flatMap((path) => {
          const model = modelByPath.get(path);
          return model ? [model] : [];
        });

        const materials = backgrounds[index].onLoad({
          sourceModels,
          sourceAnimations: animationsByModel,
          backdropGroup: title.backdropGroup,
          titleSize: title.size,
        });
        title.materials.push(...materials);
      });

      backdropsLoaded = true;

      if (titlesVisible) {
        showActiveTitle();
        backgrounds[activeIndex].onShow();
        return;
      }

      hideAllTitles();
    } catch  (e) {
      console.error('Error loading backdrop models:', e);
    }
  };

  void loadBackdrops();

  const getCameraClockwiseAngle = () => {
    titlesRoot.getWorldPosition(titlesRootWorldPosition);
    const relativeX = camera.position.x - titlesRootWorldPosition.x;
    const relativeZ = camera.position.z - titlesRootWorldPosition.z;
    return normalizeAngle(-Math.atan2(relativeX, relativeZ));
  };

  let referenceClockwiseAngle = getCameraClockwiseAngle();

  const hideAllTitles = () => {
    titles.forEach((title) => {
      setTitleOpacity(title, 0);
    });
  };

  const showActiveTitle = () => {
    // find and show the active title, hide the rest
    titles.forEach((title, index) => {
      setTitleOpacity(title, index === activeIndex ? 1 : 0);
    });
  };

  const transitionTo = (nextIndex: number) => {
    if (!titlesVisible) {
      activeIndex = nextIndex;
      return;
    }

    if (nextIndex === activeIndex) {
      return;
    }

    const currentTitle = titles[activeIndex];
    const nextTitle = titles[nextIndex];

    if (!currentTitle.loaded || !nextTitle.loaded) {
      return;
    }

    backgrounds[activeIndex].onHide();
    backgrounds[nextIndex].onShow();

    activeTransition?.kill();
    activeTransition = gsap.timeline({
      onComplete: () => {
        // Ensure all inactive titles are completely hidden after transition completes
        titles.forEach((title, index) => {
          if (index !== nextIndex) {
            setTitleOpacity(title, 0);
          }
        });
      },
    });

    activeTransition.to(currentTitle.materials, {
      opacity: 0,
      duration: 0,
    });

    activeTransition.to(nextTitle.materials, {
      opacity: 1,
      duration: .4,
      ease: 'sine.in',
    });

    activeIndex = nextIndex;
  };

  const updateFromCamera = (elapsedTime = 0) => {
    const clockwiseAngle = getCameraClockwiseAngle();
    const relativeAngle = clockwiseAngle - referenceClockwiseAngle;
    const nextIndex = getNearestTitleIndex(relativeAngle, titles.length);

    transitionTo(nextIndex);

    if (!titlesVisible) {
      return;
    }

    const activeTitle = titles[activeIndex];
    if (!activeTitle.loaded) {
      return;
    }

    // Keep the active title facing the camera with smooth slerp interpolation
    activeTitle.group.getWorldPosition(titleWorldPosition);
    cameraLookTarget.set(camera.position.x, titleWorldPosition.y, camera.position.z);
    
    // Create target quaternion from lookAt
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.lookAt(titleWorldPosition, cameraLookTarget, activeTitle.group.up);
    targetQuaternion.setFromRotationMatrix(tempMatrix);

    // Smoothly interpolate rotation using slerp (like GSAP scrub)
    smoothQuaternion.copy(activeTitle.group.quaternion).slerp(targetQuaternion, 0.1);
    activeTitle.group.quaternion.copy(smoothQuaternion);

    backgrounds[activeIndex].update({
      elapsedTime,
      camera,
      titleQuaternion: activeTitle.group.quaternion,
    });
  };

  const show = () => {
    referenceClockwiseAngle = getCameraClockwiseAngle();
    activeIndex = 0;
    titlesVisible = true;
    showActiveTitle();

    if (backdropsLoaded) {
      backgrounds[activeIndex].onShow();
    }
  };

  const hide = () => {
    titlesVisible = false;
    activeTransition?.kill();
    backgrounds.forEach((background) => {
      background.onHide();
    });
    hideAllTitles();
  };

  // Start hidden and reveal only when the GSAP intro sequence finishes.
  hide();

  const dispose = () => {
    activeTransition?.kill();
    backgrounds.forEach((background) => {
      background.dispose();
    });

    titles.forEach((title, index) => {
      setTitleOpacity(title, index === 0 ? 1 : 0);

      title.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });

      title.materials.forEach((material) => {
        material.dispose();
      });
    });
  };

  return {
    updateFromCamera,
    show,
    hide,
    dispose,
  };
};
