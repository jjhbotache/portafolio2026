import type { TitleBackgroundController } from './types';
import { createAboutMeBackground } from './aboutMeBackground';
import { createContactBackground } from './contactBackground';
import { createExperienceBackground } from './experienceBackground';
import { createProjectsBackground } from './projectsBackground';

export const createTitleBackgroundControllers = (): TitleBackgroundController[] => [
  createContactBackground(),
  createAboutMeBackground(),
  createExperienceBackground(),
  createProjectsBackground(),
];

export type {
  TitleBackgroundController,
  TitleBackgroundLoadContext,
  TitleBackgroundUpdateContext,
} from './types';
