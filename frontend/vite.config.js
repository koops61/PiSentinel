import { defineConfig } from 'vite';

export default defineConfig({
  base: '/sentinel/', // Prefix all assets with /sentinel/ so it never breaks with or without trailing slash
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
