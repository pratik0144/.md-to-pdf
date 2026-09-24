// @ts-check
/**
 * ============================================================================
 * ASTRO CONFIGURATION FILE (`astro.config.mjs`)
 * ============================================================================
 * 
 * WHAT IS ASTRO?
 * Astro is a modern web framework designed for content-focused websites.
 * By default, Astro generates pure, static HTML/CSS with ZERO JavaScript
 * sent to the browser unless you explicitly tell it to (known as "Islands Architecture").
 * 
 * WHY USE ASTRO FOR THIS TOOL?
 * 1. Zero-bloat static output: MicroConvert doesn't need a heavy runtime like
 *    React or Vue running in the background. It generates a single static HTML page.
 * 2. Component-driven development: We can break down the UI into modular, reusable
 *    `.astro` files (Header, Toolbar, Editor, DropZone) while keeping them static.
 * 3. Native TypeScript & Vite support: Vite is built into Astro, giving us fast
 *    reloads during development and optimized bundling for production.
 * 
 * FOR LEARNERS:
 * `defineConfig` provides TypeScript type hinting and autocompletion in your editor
 * without needing a TypeScript file extension (.ts).
 * 
 * Learn more: https://docs.astro.build/config
 */

import { defineConfig } from 'astro/config';

export default defineConfig({
  // By default, Astro builds to static HTML (`output: 'static'`).
  // This means `npm run build` produces pre-rendered HTML/CSS/JS in the `dist/` directory,
  // perfect for hosting on GitHub Pages, Netlify, Vercel, or any simple static web server.
});
