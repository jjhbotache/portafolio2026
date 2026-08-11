/**
 * GPU/WebGL capability detection. Produces a 0–100 score that decides
 * between the heavy (pinned mask + ScrollTrigger scrub) entrance animation
 * and a lightweight alternative that skips the mask and the scrub entirely.
 *
 * The score is a weighted blend:
 *   - renderer string match (40%)
 *   - hardware concurrency (20%)
 *   - max WebGL texture size (20%)
 *   - device pixel ratio (10%)
 *   - is mobile / coarse pointer (10%)
 *
 * `renderer` is the strongest signal because it tracks real-world WebGL
 * performance most accurately: an iGPU can report a healthy MAX_TEXTURE_SIZE
 * and still choke on complex shaders.
 *
 * SSR-safe: when called without a DOM/window, returns score 0 (low tier,
 * light mode) so the rendered HTML never depends on a feature detection
 * that ran server-side.
 */

export type GpuTier = 'low' | 'medium' | 'high';

export type GpuSignals = {
  renderer: string | null;
  vendor: string | null;
  hardwareConcurrency: number | null;
  devicePixelRatio: number | null;
  maxTextureSize: number | null;
  deviceMemory: number | null;
  isMobile: boolean;
};

export type GpuCapabilities = {
  signals: GpuSignals;
  score: number;
  tier: GpuTier;
  canRunHeavyAnimation: boolean;
  isMobile: boolean;
};

/**
 * Score above which we run the heavy (masked/pinned) landing timeline.
 *
 * Tune based on real-world device metrics: too high skips capable devices
 * into the lightweight mode; too low runs the heavy animation on hardware
 * that visibly stutters. The blend below puts most modern discrete GPUs
 * (GTX 1050+, RX 550+, Apple M1+) at 75–95, Intel UHD 620/630 at 50–65,
 * and pre-2014 iGPUs below 35.
 */
export const GPU_SCORE_THRESHOLD = 90;

/**
 * Lower-case substring patterns matched against `UNMASKED_RENDERER_WEBGL`
 * that indicate weak GPU performance. Order matters only for readability;
 * the lists are exhaustive — any match in either list wins outright.
 */
const LOW_RENDERER_PATTERNS: readonly string[] = [
  // Older Mali (T7xx/T8xx) and entry-level G3x/G5x
  'mali-t720', 'mali-t830', 'mali-t860', 'mali-t880',
  'mali-g31', 'mali-g52', 'mali-g72',
  // Low-end Adreno (1xx-3xx, before the modern 5xx-7xx line)
  'adreno 1', 'adreno 2', 'adreno 3',
  // Old Intel HD graphics (4xxx-6xxx)
  'intel(r) hd graphics 4', 'intel(r) hd graphics 5', 'intel(r) hd graphics 6',
  'intel(r) uhd graphics 6',
  // PowerVR (mobile)
  'powervr',
  // Software rasterizers (no GPU acceleration)
  'swiftshader', 'llvmpipe', 'software',
];

/**
 * Lower-case substring patterns that indicate capable WebGL performance.
 */
const HIGH_RENDERER_PATTERNS: readonly string[] = [
  // NVIDIA Turing / Ampere / Ada (consumer)
  'rtx', 'gtx 1', 'gtx 9',
  // AMD RDNA / RDNA 2 / RDNA 3
  'rx 5', 'rx 6', 'rx 7',
  // Apple Silicon (M1+)
  'apple m',
  // Professional GPUs
  'radeon pro', 'quadro',
  // Intel Arc discrete
  'arc a', 'arc 7',
];

/** SSR-safe UA + viewport heuristic. */
const isMobileUA = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/android|iphone|ipad|ipod|mobile|tablet/i.test(ua)) return true;
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches &&
    Math.min(window.innerWidth, window.innerHeight) <= 900
  ) {
    return true;
  }
  return false;
};

/**
 * Reads `WEBGL_debug_renderer_info` from a throwaway canvas. Returns
 * `{ renderer, vendor, maxTextureSize }`. Any field can be `null` when
 * the browser does not expose GPU info (Safari is the common case for
 * `null`) or when WebGL is unavailable entirely.
 */
const detectWebGL = (): {
  renderer: string | null;
  vendor: string | null;
  maxTextureSize: number | null;
} => {
  if (typeof document === 'undefined') {
    return { renderer: null, vendor: null, maxTextureSize: null };
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) {
      return { renderer: null, vendor: null, maxTextureSize: null };
    }
    let renderer: string | null = null;
    let vendor: string | null = null;
    const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugExt) {
      renderer = gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) as string | null;
      vendor = gl.getParameter(debugExt.UNMASKED_VENDOR_WEBGL) as string | null;
    }
    if (!renderer) {
      // Fallback: the standard (often masked) GL strings.
      renderer = gl.getParameter(gl.RENDERER) as string | null;
      vendor = gl.getParameter(gl.VENDOR) as string | null;
    }
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number | null;
    // Free the test context quickly. Not required for correctness, but
    // avoids keeping a context alive on devices that struggle to allocate
    // more than one.
    const lose = gl.getExtension('WEBGL_lose_context');
    lose?.loseContext();
    return { renderer, vendor, maxTextureSize };
  } catch {
    return { renderer: null, vendor: null, maxTextureSize: null };
  }
};

/**
 * 0–100 score from the renderer string. Missing renderer (Safari privacy
 * mask, which most often masks Apple Silicon devices) lands at 50 —
 * intentionally neutral so the other signals (cores, dpr, texture size)
 * can pull the final score up or down.
 */
const scoreRenderer = (renderer: string | null): number => {
  if (!renderer) return 50;
  const lc = renderer.toLowerCase();
  for (const pattern of HIGH_RENDERER_PATTERNS) {
    if (lc.includes(pattern)) return 95;
  }
  for (const pattern of LOW_RENDERER_PATTERNS) {
    if (lc.includes(pattern)) return 35;
  }
  return 70;
};

/** 1 core = 0, 8 cores = 100, linear in between. */
const scoreCores = (n: number | null): number => {
  if (n == null) return 50;
  return Math.max(0, Math.min(100, (n / 8) * 100));
};

/** Texture size correlates with the underlying GPU generation. */
const scoreTextureSize = (size: number | null): number => {
  if (size == null) return 50;
  if (size >= 16384) return 100;
  if (size >= 8192) return 90;
  if (size >= 4096) return 75;
  if (size >= 2048) return 50;
  return 25;
};

/** Higher DPR means more pixels per frame — penalize. */
const scoreDpr = (dpr: number | null): number => {
  if (dpr == null) return 50;
  if (dpr <= 1.5) return 80;
  if (dpr <= 2) return 70;
  if (dpr <= 3) return 50;
  return 30;
};

/** Mobile/tablet typically have less thermal headroom than desktop. */
const scoreIsMobile = (isMobile: boolean): number => {
  return isMobile ? 40 : 80;
};

const tierFor = (score: number): GpuTier => {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
};

const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));

/**
 * Run all the detection steps and produce a single `GpuCapabilities`
 * snapshot. Intended to be called once at page load — the signals it
 * reads do not change during a session.
 */
export const detectGpuCapabilities = (): GpuCapabilities => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      signals: {
        renderer: null,
        vendor: null,
        hardwareConcurrency: null,
        devicePixelRatio: null,
        maxTextureSize: null,
        deviceMemory: null,
        isMobile: false,
      },
      score: 0,
      tier: 'low',
      canRunHeavyAnimation: false,
      isMobile: false,
    };
  }

  const { renderer, vendor, maxTextureSize } = detectWebGL();
  const hardwareConcurrency =
    typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator
      ? (navigator.hardwareConcurrency as number)
      : null;
  const deviceMemory =
    typeof navigator !== 'undefined' && 'deviceMemory' in navigator
      ? ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null)
      : null;
  const devicePixelRatio = window.devicePixelRatio ?? null;
  const isMobile = isMobileUA();

  const signals: GpuSignals = {
    renderer,
    vendor,
    hardwareConcurrency,
    devicePixelRatio,
    maxTextureSize,
    deviceMemory,
    isMobile,
  };

  const raw = clamp(
    scoreRenderer(renderer) * 0.4 +
      scoreCores(hardwareConcurrency) * 0.2 +
      scoreTextureSize(maxTextureSize) * 0.2 +
      scoreDpr(devicePixelRatio) * 0.1 +
      scoreIsMobile(isMobile) * 0.1,
  );
  const rounded = Math.round(raw);
  const tier = tierFor(rounded);

  return {
    signals,
    score: rounded,
    tier,
    canRunHeavyAnimation: rounded >= GPU_SCORE_THRESHOLD,
    isMobile,
  };
};
