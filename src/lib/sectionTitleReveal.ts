import { gsap } from 'gsap';

// "Ink Bleed" reveal for the section detail titles (the h2 elements with
// `tron-font` rendered at the top of each `#xxxDetailedView`). Plays once
// every time the user opens a section so the title arrives from blur to
// crisp regardless of which section is active. Respects
// `prefers-reduced-motion` by clearing any inline styles and skipping the
// animation entirely.
const INK_BLEED_DURATION = 1.5;

type TitleTarget =
  | HTMLElement
  | HTMLElement[]
  | NodeListOf<HTMLElement>
  | null
  | undefined;

export const playInkBleed = (target: TitleTarget): void => {
  if (!target) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.set(target, { clearProps: 'filter,opacity,scale,transform' });
    return;
  }

  const elements: HTMLElement[] = Array.from(
    target instanceof HTMLElement ? [target] : Array.from(target),
  );
  if (elements.length === 0) return;

  gsap.from(elements, {
    filter: 'blur(20px)',
    opacity: 0,
    scale: 0.9,
    duration: INK_BLEED_DURATION,
    ease: 'power2.out',
  });
};