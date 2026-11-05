import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import tokens from './src/ui/design-tokens.json' with { type: 'json' };

const LEVEL_IDS: Record<string, string> = {
  Basis: 'basis',
  Stærk: 'staerk',
  Imponerende: 'imponerende',
  Boss: 'boss',
};

/** The fonts the first screen uses; preloaded so text is drawn in them from the start (SK1). */
const PRELOAD_FONTS = [
  'kanit-latin-700-normal.woff2',
  'bai-jamjuree-latin-400-normal.woff2',
  'bai-jamjuree-latin-600-normal.woff2',
];

/**
 * Colours from src/ui/design-tokens.json as CSS variables in index.html: --c-<name> for the
 * colours and --c-level-<id> for the level colours (docs/SPEC.md section 5).
 */
function designTokens(base: string): Plugin {
  const colours = Object.entries(tokens.color).map(([name, value]) => `--c-${name}:${value}`);
  const levels = Object.entries(tokens.level).map(
    ([name, value]) => `--c-level-${LEVEL_IDS[name] ?? name.toLowerCase()}:${value}`,
  );
  return {
    name: 'comeback-design-tokens',
    transformIndexHtml: () => [
      { tag: 'style', children: `:root{${[...colours, ...levels].join(';')}}`, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'theme-color', content: tokens.color.navy }, injectTo: 'head' },
      ...PRELOAD_FONTS.map((file) => ({
        tag: 'link',
        attrs: {
          rel: 'preload',
          href: `${base}fonts/${file}`,
          as: 'font',
          type: 'font/woff2',
          crossorigin: '',
        },
        injectTo: 'head' as const,
      })),
    ],
  };
}

export default defineConfig({
  base: '/comeback/',
  plugins: [
    preact(),
    designTokens('/comeback/'),
    VitePWA({
      registerType: 'prompt',
      // The app registers its service worker itself (from milestone 2) and shows the update banner.
      injectRegister: false,
      manifest: {
        id: '/comeback/',
        name: 'Comeback',
        short_name: 'Comeback',
        description: 'Træningsprogrammet Comeback, offline',
        lang: 'da',
        start_url: '/comeback/?source=pwa',
        scope: '/comeback/',
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
        // Everything the app needs offline: code, styles, the first-screen fonts, pictograms and
        // the Wake Lock fallback video. The probe is a separate app with its own service worker.
        globPatterns: [
          '**/*.{js,css,html,webm,png}',
          'fonts/kanit-latin-{600,700}-normal.woff2',
          'fonts/bai-jamjuree-latin-{400,600}-normal.woff2',
          'pictos/**/*.svg',
        ],
        globIgnores: ['**/node_modules/**/*', 'probe/**'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/comeback\/probe\//],
        ignoreURLParametersMatching: [/^source$/],
      },
    }),
  ],
});
