import { defineConfig } from 'vitest/config';

// Server tests only (the app itself is checked by the type checker and build).
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 30000 },
});
