import { config as loadEnv } from "dotenv";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const envPath = path.resolve(process.cwd(), ".env.dev");
loadEnv({ path: envPath, override: true });

const services = [
  {
    name: "identity",
    filter: "@ma/identity",
    extraEnv: {
      PORT: process.env.IDENTITY_PORT ?? "3100"
    }
  },
  {
    name: "portal",
    filter: "@ma/portal",
    extraEnv: {
      PORT: process.env.PORTAL_PORT ?? "3200"
    }
  },
  {
    name: "tasks",
    filter: "@ma/tasks",
    extraEnv: {
      PORT: process.env.TASKS_PORT ?? "3300"
    }
  },
  {
    name: "admin",
    filter: "@ma/admin",
    extraEnv: {
      PORT: process.env.ADMIN_PORT ?? "3500"
    }
  },
  {
    name: "worker",
    filter: "@ma/worker",
    extraEnv: {}
  }
];

const children = [];

const spawnService = ({ name, filter, extraEnv }) => {
  const child = spawn("pnpm", ["--silent", "--filter", filter, "dev"], {
    env: { ...process.env, ...extraEnv },
    stdio: "inherit"
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.info(`[${name}] exited with signal ${signal}`);
    } else if (code !== 0 && process.exitCode === undefined) {
      process.exitCode = code ?? 1;
    }
  });

  return child;
};

console.info(`Loaded dev environment from ${envPath}`);
for (const service of services) {
  console.info(
    `[${service.name}] starting with env PORT=${service.extraEnv.PORT ?? "(default)"}`
  );
  children.push(spawnService(service));
}

const shutdown = (signal) => {
  console.info(`Received ${signal}. Shutting down child processes...`);
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
