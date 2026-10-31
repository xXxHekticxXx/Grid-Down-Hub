import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the site from /<repo-name>/; the Android app serves it from /.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    // Set by the GitHub build (run number); local builds are 0 so they never look newer than a release.
    __BUILD_NUMBER__: JSON.stringify(Number(process.env.GDH_VERSION_CODE || 0)),
    __APP_VERSION__: JSON.stringify(process.env.GDH_VERSION_NAME || 'dev'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Grid-Down Hub',
        short_name: 'Grid-Down',
        description: 'Offline emergency and survival hub: maps, first aid, water, bushcraft, plants, plans and tools.',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#F2EFE7',
        theme_color: '#161A17',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell, content, book figures, fonts, sprites and styles are precached.
        // Big data packs (maps, PDFs, POIs) are downloaded into device storage instead.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,webmanifest,json,woff2,webp,pbf,mp3}'],
        globIgnores: ['data/**'],
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/data\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000, sourcemap: false, rolldownOptions: { checks: { pluginTimings: false } } },
  server: { port: 5173 },
});
