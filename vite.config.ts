import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
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
  },
})