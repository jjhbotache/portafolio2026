import { defineCollection} from "astro:content";
import { z } from 'astro/zod';
import { glob as file } from 'astro/loaders';

// A field that can be either a plain string or a bilingual `{ en, es }`
// object. Resolved at render time with `resolveBilingual(value, lang)`.
const bilingualString = z.union([
  z.object({
    en: z.string(),
    es: z.string(),
  }),
]);

// Experiences: each entry represents a job / professional engagement.
// `content` is the full markdown body of the entry (rendered below the meta).
// `imgs` are the screenshots that go inside the card's vertical Swiper.
// `importance` is a 1-5 ranking used to sort/order experiences.
const experiences = defineCollection({
    loader: file({ base: './src/content/experiences', pattern: '**/*.{md,mdx}' }),
    schema: z.object({
        title: bilingualString,
        enterprises: z.array( z.object({
          name: bilingualString,
          logo: z.url(),
          url: z.url(),
        })
        ),
        imgs: z.array(z.string()),
        importance: z.number().int(),
        technologies: z.object({
          es: z.array(z.string()),
          en: z.array(z.string())
        }),
        content: bilingualString,
        start: z.object({
          month: z.number().int().min(1).max(12),
          year: z.string(),
        }),
        end: z.optional(z.object({
          month: z.number().int().min(1).max(12),
          year: z.string(),
        })),
    description: bilingualString,
  }),
});

// Projects: side projects, demos, personal work. No enterprise, no period.
// `img` is the cover/thumbnail image (URL or path under /public).
// `video` is the link to a demo reel (YouTube, Vimeo, mp4, etc.).
// `images` are optional extra screenshots displayed in the card.
// `importance` is a 1-5 ranking used to sort/order projects.
// `hidden` is an optional boolean that excludes the project from the
// projects detail view without deleting the entry. Defaults to `false`
// so existing frontmatter keeps rendering.
const projects = defineCollection({
    loader: file({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
    schema: z.object({
      title: bilingualString,
      img: z.string(),
      importance: z.number().int(),
      hidden: z.boolean().optional().default(false),
      technologies: z.object({
        en: z.array(z.string()),
        es: z.array(z.string()),
      }),
      video: z.string(),
      links: z.array(
        z.object({
          label: bilingualString,
          url: z.url(),
        })
      ),
      description: bilingualString,
      content: bilingualString,
  }),
});

export const collections = { experiences, projects };