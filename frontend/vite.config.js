import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/expenditure_tracker/' : '/',
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  worker: { format: 'es' },
  define:
    mode === 'pages' ? { 'import.meta.env.VITE_STORAGE_MODE': JSON.stringify('browser') } : {},
  plugins: [react()],
  build: {
    rollupOptions: {
      output: { manualChunks: { charts: ['recharts'] } },
    },
  },
  test: {
    include: ['src/**/*.test.{js,jsx}'],
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
  server: { proxy: { '/api': 'http://localhost:5000' } },
}));
