import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const reactDir = path.dirname(require.resolve('react/package.json'));
const reactDomDir = path.dirname(require.resolve('react-dom/package.json'));

const usePolling = ['1', 'true', 'yes'].includes(String(process.env.VITE_USE_POLLING || process.env.CHOKIDAR_USEPOLLING || '').toLowerCase());
const pollingInterval = Number(process.env.VITE_POLLING_INTERVAL || 300);

export default defineConfig({
  // 🔧 CORREGIDO: __dirname se calcula de forma compatible con ESM y se mantiene el proxy del mockup.
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      react: reactDir,
      'react-dom': reactDomDir,
      'react/jsx-runtime': path.join(reactDir, 'jsx-runtime.js'),
      'react/jsx-dev-runtime': path.join(reactDir, 'jsx-dev-runtime.js'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: usePolling ? { usePolling: true, interval: pollingInterval } : undefined,
    proxy: {
      '/api': {
        target: process.env.PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
