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
import type { Lang } from '../../i18n/utils';
import { createExperienceBackground } from '../three/titlesBackgrounds/experienceBackground';
import { createAboutMeBackground } from '../three/titlesBackgrounds/aboutMeBackground';
import { createContactBackground } from '../three/titlesBackgrounds/contactBackground';
import { createProjectsBackground } from '../three/titlesBackgrounds/projectsBackground';

export type SectionConfig = {
  // Stable id used in code/logs (kebab-case, no spaces).
  id: string;
  // 3D model paths for the title mesh per locale. The orchestrator picks
  // the path that matches the current URL locale at scene creation time.
  // EN variants are expected to be generated manually (STL files with the
  // word in English, e.g. `experience-en.stl`). Until they exist, the ES
  // variant will be used as a fallback so the page still renders.
  titleModelPaths: { en: string; es: string };
  // Factory that creates a fresh background controller per scene. Factories
  // (not instances) are stored so each landing scene instantiates its own
  // GSAP timelines and Three.js state — no shared mutable state.
  background: () => TitleBackgroundController;
  // CSS selector (id selector recommended) of the HTML wrapper that should
  // become visible when the user opens this section's detail view.
  htmlDetailViewSelector: string;
};

// Resolve the model path for a section in the given locale, falling back to
// the other locale when the requested variant is missing on disk.
export const resolveSectionModelPath = (
  section: Pick<SectionConfig, 'titleModelPaths'>,
  lang: Lang,
): string => section.titleModelPaths[lang] ?? section.titleModelPaths.es;

export const sections: readonly SectionConfig[] = [
  {
    id: 'experience',
    titleModelPaths: { en: '/3d/experience-en.stl', es: '/3d/experiencia.stl' },
    background: createExperienceBackground,
    htmlDetailViewSelector: '#experienceDetailRoot',
  },
  {
    id: 'aboutMe',
    titleModelPaths: { en: '/3d/about-me-en.stl', es: '/3d/acerca de mi.stl' },
    background: createAboutMeBackground,
    htmlDetailViewSelector: '#aboutMeDetailedView',
  },
  {
    id: 'contact',
    titleModelPaths: { en: '/3d/contact-en.stl', es: '/3d/contacto.stl' },
    background: createContactBackground,
    htmlDetailViewSelector: '#contactDetailedView',
  },
  {
    id: 'projects',
    titleModelPaths: { en: '/3d/projects-en.stl', es: '/3d/proyectos.stl' },
    background: createProjectsBackground,
    htmlDetailViewSelector: '#projectsDetailRoot',
  },
] as const;

export const getSectionCount = (): number => sections.length;

export const getSectionByIndex = (index: number): SectionConfig | undefined => {
  if (index < 0 || index >= sections.length) {
    return undefined;
  }
  return sections[index];
};