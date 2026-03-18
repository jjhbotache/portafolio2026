import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const NEON_PART_INDEXES = new Set([0, 3]);

type LandingScene = {
  overlay: HTMLElement;
  diskRoot: any;
  camera: any;
};

const createMaterials = () => {
  const neonBlueMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f6bff,
    emissive: 0x1d4dff,
    emissiveIntensity: 1.8,
    metalness: 0.2,
    roughness: 0.25,
  });

  const blackMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b0b0e,
    emissive: 0x000000,
    emissiveIntensity: 0,
    metalness: 0.95,
    roughness: 0.2,
  });

  return { neonBlueMaterial, blackMetalMaterial };
};

const splitGeometryIntoComponents = (geometry: any) => {
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

const assignMaterialByPart = (partIndex: number, neonBlueMaterial: any, blackMetalMaterial: any) => {
  if (NEON_PART_INDEXES.has(partIndex)) {
    return neonBlueMaterial;
  }

  return blackMetalMaterial;
};

const loadDiskModel = (diskRoot: any) => {
  const { neonBlueMaterial, blackMetalMaterial } = createMaterials();
  const stlLoader = new STLLoader();

  stlLoader.load('/3d/disk.stl', (geometry: any) => {
    const { components, positions } = splitGeometryIntoComponents(geometry);

    components.forEach((componentFaces, partIndex) => {
      const componentGeometry = buildComponentGeometry(componentFaces, positions);
      const material = assignMaterialByPart(partIndex, neonBlueMaterial, blackMetalMaterial);
      const mesh = new THREE.Mesh(componentGeometry, material);

      diskRoot.add(mesh);
    });
  });
};

const addLights = (scene: any) => {
  const keyLight = new THREE.PointLight(0x59a5ff, 25, 30);
  keyLight.position.set(3, 2, 4);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0x3b82f6, 16, 20);
  rimLight.position.set(-3, -1.5, 2);
  scene.add(rimLight);

  const ambientLight = new THREE.AmbientLight(0x2047ff, 0.6);
  scene.add(ambientLight);
};

const setupResize = (camera: any, renderer: any) => {
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  window.addEventListener('resize', onResize);
};

const startRenderLoop = (diskRoot: any, controls: any, renderer: any, scene: any, camera: any) => {
  const tick = () => {
    diskRoot.rotation.y += 0.003;
    diskRoot.rotation.x += 0.0015;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };

  tick();
};

const createThreeScene = (overlay: HTMLElement | null): LandingScene | null => {
  if (!overlay) {
    return null;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020617);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 12;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  overlay.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 14;

  const diskRoot = new THREE.Group();
  diskRoot.scale.set(0.03, 0.03, 0.03);
  scene.add(diskRoot);

  loadDiskModel(diskRoot);
  addLights(scene);
  setupResize(camera, renderer);
  startRenderLoop(diskRoot, controls, renderer, scene, camera);

  return { overlay, diskRoot, camera };
};

const buildLandingTimeline = (heroMask: Element, landingScene: LandingScene | null) => {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: heroMask,
      start: 'top top',
      end: '+=600',
      scrub: 1,
      pin: true,
    },
  });

  tl.to(heroMask, {
    webkitMaskSize: '.2%',
    maskSize: '.2%',
    ease: 'sine.in',
    duration: 1,
  });

  tl.to('#content', {
    scale: 1,
    ease: 'power2.in',
    duration: 0.5,
  }, '<');

  tl.to(heroMask, {
    '--mask-pos': '50% 50%',
    ease: 'sine.in',
    duration: 0.4,
  }, 0.6);

  tl.to('#content', {
    filter: 'blur(30px)',
    ease: 'power4.in',
    duration: 0.4,
  }, 0.2);

  tl.to(heroMask, {
    '--hero-before-opacity': 1,
    ease: 'sine.out',
    duration: 0.5,
  }, 0.2);

  if (!landingScene) {
    return;
  }

  tl.to(landingScene.overlay, {
    autoAlpha: 1,
    pointerEvents: 'auto',
    duration: 0.2,
    ease: 'none',
  });

  tl.to(landingScene.camera.position, {
    z: 18,
    duration: 0.9,
    ease: 'power3.out',
  }, '<');
};

export const initializeHomeLandingScene = () => {
  window.scrollTo(0, 0);

  const heroMask = document.querySelector('#hero-mask');
  const overlay = document.querySelector('#three-overlay') as HTMLElement | null;

  const landingScene = createThreeScene(overlay);

  if (!heroMask) {
    return;
  }

  buildLandingTimeline(heroMask, landingScene);
};
