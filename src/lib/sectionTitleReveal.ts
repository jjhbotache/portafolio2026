import { gsap } from 'gsap';

// "Ink Bleed" reveal for the section detail titles (the h2 elements with
// `tron-font` rendered at the top of each `#xxxDetailedView`). Plays once
// every time the user opens a section so the title arrives from blur to
// crisp regardless of which section is active. Respects
// `prefers-reduced-motion` by clearing any inline styles and skipping the
// animation entirely.

type TitleTarget =
  | HTMLElement
  | HTMLElement[]
  | NodeListOf<HTMLElement>
  | null
  | undefined;

export const playTitleIntroAnimation = (target: TitleTarget): void => {
  if (!target) return;

    const elements: HTMLElement[] = Array.from(
    target instanceof HTMLElement ? [target] : Array.from(target),
  );
  if (elements.length === 0) return;

    const tl = gsap.timeline();
    tl.set(elements, { opacity: 0, textShadow: "none" })
      .to(elements, { opacity: 1, duration: 0.1 })
      .from(elements, {
        clipPath: "inset(0 100% 0 0)",
        duration: 1.2, ease: "power3.inOut"
      })
      .to(elements, { opacity: 0.2, duration: 0.05 })
      .to(elements, { opacity: 1, duration: 0.1 })
      .to(elements, { opacity: 0, duration: 0.05 })
      .to(elements, { opacity: 0.2, duration: 0.1 })
      .to(elements, { opacity: 1, duration: 0.3 })
      .to(elements, { opacity: 0, duration: 0.05 })
      .to(elements, { opacity: 1, textShadow: "0 0 8px #07eaff", duration: 1 });
};