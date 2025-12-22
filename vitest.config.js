import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'app/renderer/dist/',
        'tests/',
        '*.config.js',
        'app/main/main.js',
        'app/main/preload.js'
      ],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50
      },
      reportOnFailure: true
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app/renderer/src')
    }
  }
});

