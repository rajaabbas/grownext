import baseConfig from "../config/vitest.config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"]
  }
});
