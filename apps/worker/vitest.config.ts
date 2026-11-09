import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    hookTimeout: 30_000,
    fileParallelism: false, // test files share one database
  },
});
