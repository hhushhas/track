import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['convex/**/*.{test,spec}.{ts,tsx,js,jsx,mts,mtsx,cts,cjs}'],
    exclude: ['**/node_modules/**', '**/.git/**', '**/.worktrees/**'],
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
  },
})
