import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: { main: 'index.html', brand: 'brand-guide.html' } } },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
