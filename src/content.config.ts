import { defineCollection} from "astro:content";
import { z } from 'astro/zod';
import { glob as file } from 'astro/loaders';

// Experiences: each entry represents a job / professional engagement.
// `content` is the full markdown body of the entry (rendered below the meta).
// `imgs` are the screenshots that go inside the card's vertical Swiper.
const experiences = defineCollection({
    loader: file({ base: './src/content/experiences', pattern: '**/*.{md,mdx}' }),
    schema: z.object({
        title: z.string(),
        enterprises: z.array(
        z.object({
            name: z.string(),
            logo: z.string().url(),
            url: z.string().url(),
        })
        ),
        imgs: z.array(z.string().url()),
        technologies: z.array(z.string()),
        content: z.string(),
        start: z.object({
        month: z.number().int().min(1).max(12),
        year: z.string(),
        }),
    end: z.object({
      month: z.number().int().min(1).max(12),
      year: z.string(),
    }),
    description: z.string(),
  }),
});

// Projects: side projects, demos, personal work. No enterprise, no period.
// `video` is the link to a demo reel (YouTube, Vimeo, mp4, etc.).
// `links` is a free-form list of related links (repo, live demo, store, etc.).
const projects = defineCollection({
    loader: file({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    technologies: z.array(z.string()),
    video: z.string().url(),
    links: z.array(
      z.object({
        label: z.string(),
        url: z.string().url(),
      })
    ),
    description: z.string(),
  }),
});

export const collections = { experiences, projects };
