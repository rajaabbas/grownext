import baseConfig from "../config/vitest.config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["src/**/*.test.ts"]
  }
});
