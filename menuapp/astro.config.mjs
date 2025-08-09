// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
    assets: '_astro'
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      cssCodeSplit: false, // Inline critical CSS
      rollupOptions: {
        output: {
          manualChunks: undefined, // Disable chunk splitting for smaller bundles
        }
      }
    }
  },
  // Configure for CloudFlare Pages
  site: 'https://menu.example.com', // Update with actual domain
  base: '/',
  // Optimize for performance
  compressHTML: true,
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover'
  },
  image: {
    // Enable image optimization
    service: {
      entrypoint: 'astro/assets/services/sharp'
    }
  }
});
