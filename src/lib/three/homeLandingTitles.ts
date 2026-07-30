import * as THREE from 'three';
import gsap from 'gsap';
import { materialFactory } from './materialFactory';
import { fetchCachedStl, fetchCachedGltf } from './modelCache';
import { sections, resolveSectionModelPath, type SectionConfig } from '../sections';
import type { Lang } from '../../i18n/utils';
import type { TitleBackgroundController } from './titlesBackgrounds/types';

// All section data (model path, background factory, detail view selector, ...)
// is centralized in `src/lib/sections/index.ts`. The order of `sections` defines
// the order of the titles around the disk.
const buildTitleSequence = (lang: Lang): readonly string[] =>
  sections.map((s) => resolveSectionModelPath(s, lang));

const ANGLE_PER_TITLE = (Math.PI * 2) / sections.length;

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
  mesh?: THREE.Mesh;
};

const setTitleOpacity = (title: LandingTitle, opacity: number) => {
  title.materials.forEach((material) => {
    material.opacity = opacity;
  });
};

const loadTitleModel = (
  path: string,
  root: THREE.Group,
  backdropRoot: THREE.Group,
): LandingTitle => {
  const titleGroup = new THREE.Group();
  const backdropGroup = new THREE.Group();
  titleGroup.add(backdropGroup);
  // Drop the per-title visibility root inside `backdropGroup` so traversing
  // the title still visits the backdrop meshes, but flipping
  // `backdropRoot.visible` only affects that one section's content.
  backdropGroup.add(backdropRoot);

  const title: LandingTitle = {
    group: titleGroup,
    backdropGroup,
    materials: [],
    size: new THREE.Vector3(1, 1, 1),
    loaded: false,
  };

  root.add(titleGroup);

  // Use the shared model cache so re-creating the landing scene (SPA nav,
  // language toggle, ...) hits the parsed BufferGeometry instead of
  // downloading the STL again.
  fetchCachedStl(path)
    .then((geometry) => {
      // Skip the `computeBoundingBox` here: `fetchCachedStl` already ran it
      // when the geometry first resolved, so the cached version has it.
      geometry.computeVertexNormals();

      const bounds = geometry.boundingBox;
      if (bounds) {
        bounds.getSize(title.size);
      }

      const material = materialFactory('diskNeon').clone();
      material.transparent = true;
      material.opacity = 0;
      material.depthWrite = false;

      const mesh = new THREE.Mesh(geometry, material);
      title.mesh = mesh;
      titleGroup.add(mesh);
      title.materials.push(material);
      title.loaded = true;
    })
    .catch(() => {
      title.loaded = false;
    });

  return title;
};

export const createLandingTitles = (
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  lang: Lang = 'en',
) => {
  // Each section declares its own background factory. We instantiate them all
  // up front so GSAP timelines, model references and Three.js state are owned
  // by this landing scene and can be safely disposed together.
  const backgrounds: TitleBackgroundController[] = sections.map((s) => s.background());
  const titleWorldPosition = new THREE.Vector3();
  const titlesRootWorldPosition = new THREE.Vector3();
  const cameraLookTarget = new THREE.Vector3();
  const targetQuaternion = new THREE.Quaternion();
  const smoothQuaternion = new THREE.Quaternion();
  const tempMatrix = new THREE.Matrix4();
  const animationsByModel = new Map<THREE.Object3D, THREE.AnimationClip[]>();
  const titlesRoot = new THREE.Group();
  titlesRoot.scale.set(0.03, 0.03, 0.03);
  titlesRoot.rotation.set(0, THREE.MathUtils.degToRad(180), 0);
  titlesRoot.position.set(0, 2.2, 0);

  scene.add(titlesRoot);

  // Parallel array of root groups used to control per-backdrop visibility.
  // Each entry lives under the corresponding title's `backdropGroup` and
  // owns the meshes produced by that background's `onLoad`. We toggle
  // `visible` on these roots (instead of relying on opacity alone) so the
  // renderer skips hidden backdrops entirely once a fade-out completes.
  const backdropRoots: THREE.Group[] = buildTitleSequence(lang).map(() => new THREE.Group());
  const titles = buildTitleSequence(lang).map((path, index) =>
    loadTitleModel(path, titlesRoot, backdropRoots[index]),
  );

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
            // Cache hits return the same BufferGeometry that the title
            // loader used (when applicable), so the only per-scene work
            // here is wrapping it in a fresh Mesh + Group.
            const geometry = await fetchCachedStl(path);
            geometry.computeVertexNormals();
            const mat = materialFactory('platformDark');
            const mesh = new THREE.Mesh(geometry, mat);
            const group = new THREE.Group();
            group.add(mesh);
            return [path, group] as const;
          }

          const cached = await fetchCachedGltf(path);
          // Clone the cached scene so this scene owns its Object3D graph.
          // Without cloning, two landing scenes would share the same root
          // and any state mutation (visibility, transforms, ...) would
          // leak between them.
          const sceneClone = cached.scene.clone(true);
          if (cached.animations.length) {
            animationsByModel.set(sceneClone, cached.animations);
          }
          return [path, sceneClone] as const;
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
          backdropRoot: backdropRoots[index],
          titleSize: title.size,
        });
        title.materials.push(...materials);

        // Wrap the background's `onHidden` so that flipping the visibility
        // root off is the last step of the hide sequence. We chain in any
        // user-supplied `onHidden` first (e.g. tween-complete hooks), then
        // set `visible = false` so the renderer skips the section entirely.
        const previousOnHidden = backgrounds[index].onHidden;
        const rootForThisIndex = backdropRoots[index];
        backgrounds[index].onHidden = () => {
          previousOnHidden?.();
          if (rootForThisIndex) {
            rootForThisIndex.visible = false;
          }
        };
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

    // Make the next backdrop visible *before* its fade-in begins so both
    // old and new sections render for the duration of the cross-fade. The
    // previous root flips to `visible = false` only when the previous
    // background's `onHidden` callback fires (after any fade-out tween),
    // wired up in `loadBackdrops`.
    const oldIndex = activeIndex;
    const nextBackdropRoot = backdropRoots[nextIndex];
    if (nextBackdropRoot) {
      nextBackdropRoot.visible = true;
    }

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
      onStart: () => {
        // Kick off the new section's fade-in alongside the still-running
        // fade-out of the previous section.
        backgrounds[nextIndex].onShow();
      },
    });

    // Kick off the previous section's hide sequence. The wrapped
    // `onHidden` (set up in `loadBackdrops`) will flip its root to
    // `visible = false` once any internal tween completes.
    backgrounds[oldIndex].onHide();

    activeIndex = nextIndex;
  };

  let isPaused = false;
  const setPaused = (paused: boolean) => {
    isPaused = paused;
  };

  const updateFromCamera = (elapsedTime = 0) => {
    if (isPaused) {
      if (titlesVisible && activeIndex >= 0) {
        const activeTitle = titles[activeIndex];
        if (activeTitle?.loaded) {
          backgrounds[activeIndex]?.update({
            elapsedTime,
            camera,
            titleQuaternion: activeTitle.group.quaternion,
          });
        }
      }
      return;
    }

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

    // Reuse tempMatrix allocated in closure to avoid allocations in the render loop
    tempMatrix.lookAt(titleWorldPosition, cameraLookTarget, activeTitle.group.up);
    targetQuaternion.setFromRotationMatrix(tempMatrix);

    // Smoothly interpolate rotation using slerp (like GSAP scrub)
    smoothQuaternion.copy(activeTitle.group.quaternion).slerp(targetQuaternion, 0.8);
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
    setPaused,
    areTitlesVisible: () => titlesVisible,
    getActiveTitleGroup: () => titles[activeIndex]?.group,
    getActiveBackdropGroup: () => titles[activeIndex]?.backdropGroup,
    getActiveSectionIndex: () => activeIndex,
    getActiveSection: (): SectionConfig | undefined => sections[activeIndex],
  };
};
  