import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    hookTimeout: 180_000,
    testTimeout: 30_000,
    // Database-backed tests share one in-memory MongoDB; keep test files sequential.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      // Never hit a real LLM in tests — the deterministic fallback is used.
      LLM_PROVIDER: 'none',
      // Override with TEST_MONGODB_URI for an in-memory MongoDB in CI.
      MONGODB_URI: process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/medipredict_test',
      JWT_SECRET: 'test-secret-test-secret-test-secret-test-secret',
    },
  },
});
