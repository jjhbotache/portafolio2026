import type { TitleBackgroundController } from './types';
import { createAboutMeBackground } from './aboutMeBackground';
import { createContactBackground } from './contactBackground';
import { createExperienceBackground } from './experienceBackground';
import { createProjectsBackground } from './projectsBackground';

export const createTitleBackgroundControllers = (): TitleBackgroundController[] => [
  // this order is important, it should match the title sequence in homeLandingTitles.ts
  createExperienceBackground(),
  createAboutMeBackground(),
  createContactBackground(),
  createProjectsBackground(),
];

export type {
  TitleBackgroundController,
  TitleBackgroundLoadContext,
  TitleBackgroundUpdateContext,
} from './types';
