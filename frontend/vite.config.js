import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Relative assets so it works seamlessly under /sentinel or at root
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
