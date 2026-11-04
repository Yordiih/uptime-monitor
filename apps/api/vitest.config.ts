import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    fileParallelism: false, // test files share one database
    hookTimeout: 30_000,
  },
});
