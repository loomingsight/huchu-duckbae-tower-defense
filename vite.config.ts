import { defineConfig } from 'vite';

export default defineConfig({
  base: '/huchu-duckbae/tower-defense/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
