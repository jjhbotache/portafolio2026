// Centralized configuration for the landing scene sections.
// This is the single source of truth for:
//   - The order of titles around the disk
//   - Which 3D model each title loads
//   - Which background controller factory backs each title
//   - Which HTML detail view (in index.astro) gets shown when the user opens a section
//
// IMPORTANT: the order of this array is the order of the titles around the
// disk. Do not reorder unless you also re-layout the 3D scene accordingly.

import type { TitleBackgroundController } from '../three/titlesBackgrounds/types';
import { createExperienceBackground } from '../three/titlesBackgrounds/experienceBackground';
import { createAboutMeBackground } from '../three/titlesBackgrounds/aboutMeBackground';
import { createContactBackground } from '../three/titlesBackgrounds/contactBackground';
import { createProjectsBackground } from '../three/titlesBackgrounds/projectsBackground';

export type SectionConfig = {
  // Stable id used in code/logs (kebab-case, no spaces).
  id: string;
  // Path to the STL/GLB used as the title mesh for this section.
  titleModelPath: string;
  // Factory that creates a fresh background controller per scene. Factories
  // (not instances) are stored so each landing scene instantiates its own
  // GSAP timelines and Three.js state — no shared mutable state.
  background: () => TitleBackgroundController;
  // CSS selector (id selector recommended) of the HTML wrapper that should
  // become visible when the user opens this section's detail view.
  htmlDetailViewSelector: string;
};

export const sections: readonly SectionConfig[] = [
  {
    id: 'experience',
    titleModelPath: '/3d/experiencia.stl',
    background: createExperienceBackground,
    htmlDetailViewSelector: '#experienceDetailedView',
  },
  {
    id: 'aboutMe',
    titleModelPath: '/3d/acerca de mi.stl',
    background: createAboutMeBackground,
    htmlDetailViewSelector: '#aboutMeDetailedView',
  },
  {
    id: 'contact',
    titleModelPath: '/3d/contacto.stl',
    background: createContactBackground,
    htmlDetailViewSelector: '#contactDetailedView',
  },
  {
    id: 'projects',
    titleModelPath: '/3d/proyectos.stl',
    background: createProjectsBackground,
    htmlDetailViewSelector: '#projectsDetailedView',
  },
] as const;

export const getSectionCount = (): number => sections.length;

export const getSectionByIndex = (index: number): SectionConfig | undefined => {
  if (index < 0 || index >= sections.length) {
    return undefined;
  }
  return sections[index];
};
