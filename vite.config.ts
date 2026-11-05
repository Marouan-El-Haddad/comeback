import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import tokens from './src/ui/design-tokens.json' with { type: 'json' };

export default defineConfig({
  base: '/comeback/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      // Nothing registers the app's service worker until milestone 2 adds the update banner,
      // so it cannot interfere with the probe on /comeback/probe/ (docs/DECISIONS.md D13).
      injectRegister: false,
      manifest: {
        id: '/comeback/',
        name: 'Comeback',
        short_name: 'Comeback',
        description: 'Træningsprogrammet Comeback, offline',
        lang: 'da',
        start_url: '/comeback/',
        scope: '/comeback/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: tokens.color.navy,
        background_color: tokens.color.paper,
        icons: [],
      },
      workbox: {
        // The probe is a separate app with its own service worker and scope.
        globIgnores: ['**/node_modules/**/*', 'probe/**'],
        navigateFallbackDenylist: [/^\/comeback\/probe\//],
      },
    }),
  ],
});
