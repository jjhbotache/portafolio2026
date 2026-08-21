// "Ink Bleed" reveal for the section detail titles (the h2 elements with
// `tron-font` rendered at the top of each `#xxxDetailedView`). Plays once
// every time the user opens a section so the title arrives from blur to
// crisp regardless of which section is active.
//
// Implementation: pure CSS. The `@keyframes ink-bleed` rule lives in
// `src/styles/global.css`; here we just toggle the `.ink-bleed` class and
// force a reflow so the animation retriggers cleanly on every section
// open. `prefers-reduced-motion` is honored by the matching media query
// in `global.css` (the animation is skipped and the title renders in its
// final state directly).

type TitleTarget =
  | HTMLElement
  | HTMLElement[]
  | NodeListOf<HTMLElement>
  | null
  | undefined;

const triggerInkBleed = (el: HTMLElement): void => {
  el.classList.remove('ink-bleed');
  // Force reflow so removing+adding the class in the same tick still
  // retriggers the CSS animation. Without this, the browser coalesces
  // the style mutations and the keyframe never re-runs.
  void el.offsetWidth;
  el.classList.add('ink-bleed');
};

export const playTitleIntroAnimation = (target: TitleTarget): void => {
  if (!target) return;

  const elements: HTMLElement[] = Array.from(
    target instanceof HTMLElement ? [target] : Array.from(target),
  );
  if (elements.length === 0) return;

  elements.forEach(triggerInkBleed);
};