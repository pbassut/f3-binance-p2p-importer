import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'frontend/**'],
    include: ['src/**/*.test.ts'],
  },
});