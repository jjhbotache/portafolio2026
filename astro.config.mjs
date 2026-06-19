// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

import icon from 'astro-icon';

export default defineConfig({
  output: 'server',

  adapter: node({
    mode: 'standalone'
  }),

  // Prefetch internal links as soon as they enter the viewport so client-side
  // navigation feels instant without preloading everything upfront.
  prefetch: {
    defaultStrategy: 'viewport',
    prefetchAll: false,
  },

  compressHTML: true,

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [icon()]
});