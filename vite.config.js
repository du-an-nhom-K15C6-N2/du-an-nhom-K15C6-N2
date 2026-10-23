import { defineConfig } from 'vite';

const backendTarget = process.env.BACKEND_URL || 'http://127.0.0.1:3001';

const backendProxy = {
  '/api': {
    target: backendTarget,
    changeOrigin: true
  },
  '/courses': {
    target: backendTarget,
    changeOrigin: true
  },
  '/features': {
    target: backendTarget,
    changeOrigin: true
  },
  '/lead-management': {
    target: backendTarget,
    changeOrigin: true
  },
  '/forgot-password.html': {
    target: backendTarget,
    changeOrigin: true
  },
  '/reset-password.html': {
    target: backendTarget,
    changeOrigin: true
  },
  '/login.html': {
    target: backendTarget,
    changeOrigin: true
  }
};

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 8080,
    strictPort: true,
    proxy: backendProxy
  },
  preview: {
    proxy: backendProxy
  }
});
