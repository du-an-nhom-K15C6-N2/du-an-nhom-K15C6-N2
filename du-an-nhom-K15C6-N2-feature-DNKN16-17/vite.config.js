import { defineConfig } from 'vite';

const backendProxy = {
  '/api': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true
  },
  '/forgot-password.html': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true
  },
  '/reset-password.html': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true
  },
  '/login.html': {
    target: 'http://127.0.0.1:3000',
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
