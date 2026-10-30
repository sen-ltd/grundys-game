import { defineConfig } from 'vite';

export default defineConfig({
  base: '/portfolio/grundys-game/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
