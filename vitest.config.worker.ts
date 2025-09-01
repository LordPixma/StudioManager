import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'miniflare',
    environmentOptions: {
      modules: true,
      compatibilityDate: '2024-01-01',
      compatibilityFlags: ['nodejs_compat'],
      bindings: {
        JWT_SECRET: 'test-secret',
        NODE_ENV: 'development',
      },
  d1Databases: { DB: {} },
      assets: {
        // no assets needed in tests
      },
    },
    include: ['worker/test/**/*.test.ts'],
  },
})
