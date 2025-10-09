import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["**/*.test.{ts,tsx}"]
  },
  resolve: {
    alias: {
      "@": path.resolve(moduleDir, "./"),
      "@ma/core": path.resolve(moduleDir, "../../packages/core/src"),
      "@ma/contracts": path.resolve(moduleDir, "../../packages/contracts/src"),
      "@ma/db": path.resolve(moduleDir, "../../packages/db/src"),
      "@ma/ui": path.resolve(moduleDir, "../../packages/ui/src")
    }
  },
  esbuild: {
    jsx: "automatic"
  }
});
