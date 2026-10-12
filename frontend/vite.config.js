import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3's Sass source still uses @import and global functions.
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks cache across deploys; app code changes more often.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          bootstrap: ['react-bootstrap'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Override with API_PROXY_TARGET when the API runs on another port.
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
    // A page's first lazy import (e.g. a dashboard with charts) can take several seconds in jsdom;
    // the per-test limit must be longer than findBy*'s 20s wait (src/test/setup.js).
    testTimeout: 30000,
  },
});
