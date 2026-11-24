import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BUILD_TARGET: 'web' (installable web app), 'desktop' (Windows) or 'android'.
const target = process.env.BUILD_TARGET || 'web';

export default defineConfig({
    base: './',
    define: { __TARGET__: JSON.stringify(target) },
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 4000 },
    plugins: [
        react(),
        VitePWA({
            disable: target !== 'web',
            registerType: 'autoUpdate',
            injectRegister: false,
            includeAssets: ['icons/favicon.png', 'icons/apple-touch-icon.png'],
            manifest: {
                name: 'AgriMunim',
                short_name: 'AgriMunim',
                description: 'Billing, stock, udhaar and AI crop advice for agri-input shops',
                lang: 'en-IN',
                start_url: './',
                scope: './',
                display: 'standalone',
                orientation: 'any',
                theme_color: '#2E7D57',
                background_color: '#F4F7F2',
                icons: [
                    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                    { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
                maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
                navigateFallback: 'index.html',
            },
        }),
    ],
});
