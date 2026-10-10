import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/lattice/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'math', test: /node_modules[\\/]katex/ }],
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
});
