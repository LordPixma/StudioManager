import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
  // Optional: during local UI-only dev, you can proxy /api to a running wrangler dev port.
  // Update target to your wrangler dev URL if needed, or remove this block.
  // proxy: {
  //   '/api': {
  //     target: 'http://127.0.0.1:8787',
  //     changeOrigin: true,
  //   },
  // },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Group large deps into stable vendor chunks for better caching.
        manualChunks(id) {
          const p = id.split('\\').join('/')
          if (p.indexOf('node_modules') === -1) return undefined

          // Calendaring libs
          if (p.indexOf('@fullcalendar/') !== -1) return 'fullcalendar'

          // React core vs router
          if (p.indexOf('react-router-dom') !== -1) return 'react-router'
          if (p.indexOf('/node_modules/react/') !== -1) return 'react-vendor'

          // Data fetching/cache
          if (p.indexOf('/@tanstack/') !== -1) return 'react-query'

          // Forms & validation
          if (p.indexOf('/react-hook-form') !== -1 || p.indexOf('/@hookform') !== -1 || p.indexOf('/zod') !== -1) return 'forms'

          // HTTP client
          if (p.indexOf('/axios') !== -1) return 'axios'

          // State management
          if (p.indexOf('/zustand') !== -1) return 'state'

          // UI utilities
          if (p.indexOf('/lucide-react') !== -1 || p.indexOf('/clsx') !== -1 || p.indexOf('/tailwind-merge') !== -1) return 'ui-utils'

          // Fallback vendor bucket
          return 'vendor'
        },
      },
    },
  },
})