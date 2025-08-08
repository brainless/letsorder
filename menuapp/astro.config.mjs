// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  build: {
    format: 'directory'
  },
  vite: {
    plugins: [tailwindcss()]
  },
  // Configure for CloudFlare Pages
  site: 'https://menu.example.com', // Update with actual domain
  base: '/',
  // Optimize for performance
  compressHTML: true
});
