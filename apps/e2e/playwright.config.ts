import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const resolveEnvPath = () => {
  const customPath = process.env.E2E_ENV_PATH;
  if (customPath) {
    return path.isAbsolute(customPath)
      ? customPath
      : path.resolve(process.cwd(), customPath);
  }

  const rootEnvPath = path.resolve(moduleDir, "../../.env");
  return fs.existsSync(rootEnvPath) ? rootEnvPath : undefined;
};

const envPath = resolveEnvPath();
dotenv.config(envPath ? { path: envPath } : undefined);

const webServerCommand = process.env.E2E_WEB_SERVER ?? "pnpm dev";

const defaultPort = process.env.PORT ?? "3000";
const defaultPortNumber = Number(defaultPort);
const webServerPort = Number(process.env.E2E_WEB_PORT ?? defaultPortNumber);
const hasWebServerCommand = Boolean(webServerCommand && webServerCommand.trim().length > 0);

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  globalSetup: "./global-setup.ts",
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 3,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { open: "never" }]
      ]
    : [
        ["line"],
        ["html", { open: "never" }]
      ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${defaultPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] }
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] }
    }
  ],
  webServer: hasWebServerCommand
    ? [
        {
          command: webServerCommand,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          port: webServerPort
        }
      ]
    : undefined
});
