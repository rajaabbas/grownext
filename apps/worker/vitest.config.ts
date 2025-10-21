import path from "node:path";
import { fileURLToPath } from "node:url";
import baseConfig from "../../packages/config/vitest.config";
import { defineConfig } from "vitest/config";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"]
  },
  resolve: {
    alias: {
      "@": path.resolve(moduleDir, "./src"),
      "@ma/core": path.resolve(moduleDir, "../../packages/core/src"),
      "@ma/contracts": path.resolve(moduleDir, "../../packages/contracts/src"),
      "@ma/db": path.resolve(moduleDir, "../../packages/db/src"),
      "@ma/tasks-db": path.resolve(moduleDir, "../../packages/tasks-db/src")
    }
  }
});
