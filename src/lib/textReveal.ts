import gsap from 'gsap';

// Splits the text content of an element into individual <span class="tron-letter"> characters.
// Preserves whitespace by inserting a non-breaking space span so layout doesn't collapse.
const splitIntoLetters = (element: HTMLElement) => {
  if (element.dataset.lettersSplit === 'true') {
    return;
  }

  const text = element.textContent ?? '';
  element.textContent = '';
  element.dataset.lettersSplit = 'true';

  const fragment = document.createDocumentFragment();

  for (const char of text) {
    if (char === ' ') {
      const space = document.createElement('span');
      space.className = 'tron-letter tron-letter--space';
      space.innerHTML = '&nbsp;';
      fragment.appendChild(space);
      continue;
    }

    const span = document.createElement('span');
    span.className = 'tron-letter';
    span.textContent = char;
    fragment.appendChild(span);
  }

  element.appendChild(fragment);
};

// Plays the reveal animation on every .tron-letter child of the element.
// Uses prefers-reduced-motion to skip the animation entirely.
const playReveal = (element: HTMLElement) => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const letters = element.querySelectorAll<HTMLElement>('.tron-letter');

  if (reducedMotion) {
    gsap.set(letters, { opacity: 1, y: 0, clearProps: 'transform' });
    element.dataset.revealed = 'true';
    return null;
  }

  gsap.set(letters, { opacity: 0, y: '0.6em' });

  const timeline = gsap.timeline({
    onComplete: () => {
      element.dataset.revealed = 'true';
    },
  });

  timeline.to(letters, {
    opacity: 1,
    y: 0,
    duration: 0.45,
    ease: 'power2.out',
    stagger: 0.03,
  });

  return timeline;
};

// Resets the element to its hidden state so the reveal can run again on the next open.
const resetReveal = (element: HTMLElement) => {
  const letters = element.querySelectorAll<HTMLElement>('.tron-letter');
  gsap.killTweensOf(letters);
  gsap.set(letters, { opacity: 0, y: '0.6em' });
  element.dataset.revealed = 'false';
};

// Public helper: split (if needed) + reveal. Safe to call multiple times.
export const revealText = (element: HTMLElement | null | undefined) => {
  if (!element) {
    return null;
  }
  splitIntoLetters(element);
  return playReveal(element);
};

// Public helper: split (if needed) + reset to hidden. Used when the detail view closes.
export const resetTextReveal = (element: HTMLElement | null | undefined) => {
  if (!element) {
    return;
  }
  splitIntoLetters(element);
  resetReveal(element);
};

// Reveals the visible heading inside an active section detail view.
// `selector` is the CSS selector used to find the heading inside the section root.
export const revealActiveSectionTitle = (sectionRoot: HTMLElement | null | undefined) => {
  if (!sectionRoot) {
    return null;
  }
  // Find the visible h2 (the one matching the current document language).
  const heading = sectionRoot.querySelector<HTMLElement>('h2:not(.hidden)');
  return revealText(heading);
};

export const resetActiveSectionTitle = (sectionRoot: HTMLElement | null | undefined) => {
  if (!sectionRoot) {
    return;
  }
  const heading = sectionRoot.querySelector<HTMLElement>('h2:not(.hidden)');
  resetTextReveal(heading);
};
