import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Icon files in public/ keep a stable filename across builds, so browsers, CDNs,
// and iOS's own touch-icon cache can keep serving stale bytes at that URL after
// a redeploy. Appending this content hash as a query param forces a fresh fetch
// whenever scripts/gen-icons.mjs actually changes the icon artwork.
const { version: iconVersion } = JSON.parse(readFileSync('./icon-version.json', 'utf-8'));

function iconCacheBust(): Plugin {
  return {
    name: 'icon-cache-bust',
    transformIndexHtml(html) {
      return html
        .replace('/favicon.png"', `/favicon.png?v=${iconVersion}"`)
        .replace('/icons/apple-touch-icon.png"', `/icons/apple-touch-icon.png?v=${iconVersion}"`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    iconCacheBust(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/*.png'],
      manifest: {
        name: 'Mandaly — كروت عائلية',
        short_name: 'Mandaly',
        description: 'لعبة كروت عائلية للتقارب والمرح — أسئلة وتحديات بالعربية',
        lang: 'ar',
        dir: 'rtl',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0F1B3C',
        theme_color: '#0F1B3C',
        icons: [
          { src: `icons/icon-192.png?v=${iconVersion}`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `icons/icon-512.png?v=${iconVersion}`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: `icons/icon-maskable-512.png?v=${iconVersion}`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,ico,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
