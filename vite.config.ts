/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/kill-enemy/',
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
  },
});
