import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const usePolling = ['1', 'true', 'yes'].includes(String(process.env.VITE_USE_POLLING || process.env.CHOKIDAR_USEPOLLING || '').toLowerCase());
const pollingInterval = Number(process.env.VITE_POLLING_INTERVAL || 300);

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
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
