import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// Pages serves from /minesweeper-clean/, the container from /.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Minesweeper',
        short_name: 'Minesweeper',
        description: 'A clean, animated Minesweeper.',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#2b2b2b',
        theme_color: '#2b2b2b',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The UI is English-only; other Inter subsets load on demand if ever needed.
        globIgnores: ['**/rubik-{arabic,cyrillic,cyrillic-ext,hebrew}-*'],
      },
    }),
  ],
  server: { host: true },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
