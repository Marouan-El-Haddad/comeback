import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import tokens from '../src/ui/design-tokens.json' with { type: 'json' };

// Milestone 0 probe: a separate app on /comeback/probe/ with its own manifest and service worker.
// The build must stay deterministic (no timestamps): an unchanged probe has to produce an unchanged
// service worker, or unrelated deploys would show "Ny version klar" (docs/DECISIONS.md D15).

/** Colour tokens from src/ui/design-tokens.json as CSS variables (--c-<name>) in index.html. */
function designTokens(): Plugin {
  const vars = Object.entries(tokens.color)
    .map(([name, value]) => `--c-${name}:${value}`)
    .join(';');
  return {
    name: 'probe-design-tokens',
    transformIndexHtml: () => [
      { tag: 'style', children: `:root{${vars}}`, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'theme-color', content: tokens.color.navy }, injectTo: 'head' },
    ],
  };
}

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/comeback/probe/',
  build: { outDir: '../dist/probe', emptyOutDir: true },
  server: { port: 5174 },
  plugins: [
    preact(),
    designTokens(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/comeback/probe/',
        name: 'Comeback-probe',
        short_name: 'Probe',
        description: 'Teknisk afprøvning af telefonen (milepæl 0)',
        lang: 'da',
        // ?source=pwa tells the probe that it was opened from the home-screen icon (point 1).
        start_url: '/comeback/probe/?source=pwa',
        scope: '/comeback/probe/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: tokens.color.navy,
        background_color: tokens.color.paper,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The icons are precached as manifest icons; the video is the Wake Lock fallback (point 5).
        globPatterns: ['**/*.{js,css,html,webm}'],
        ignoreURLParametersMatching: [/^source$/],
      },
    }),
  ],
});
