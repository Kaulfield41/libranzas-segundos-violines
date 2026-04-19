import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Libranzas Orquesta',
        short_name: 'Libranzas',
        description: 'Gestión de libranzas de la sección',
        theme_color: '#1e3a5f',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/musico',
        icons: [
          { src: 'icon-violin-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-violin-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
})
