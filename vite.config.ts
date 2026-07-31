import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    dedupe: ['three'],
  },
  build: {
    lib: {
      entry: 'src/product-3d-widget.ts',
      formats: ['es'],
      fileName: () => 'product-3d-widget.js',
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
