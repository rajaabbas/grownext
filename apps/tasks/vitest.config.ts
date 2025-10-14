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
      "@ma/identity-client": path.resolve(moduleDir, "../../packages/identity-client/src"),
      "@ma/ui": path.resolve(moduleDir, "../../packages/ui/src")
    }
  },
  esbuild: {
    jsx: "automatic"
  }
});
