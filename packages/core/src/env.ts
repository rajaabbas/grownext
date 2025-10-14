import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Load environment variables from the repo root `.env` file (or a custom path) before validation.
const currentDir = path.dirname(fileURLToPath(import.meta.url));

const resolveEnvPath = (): string | undefined => {
  const customPath = process.env.DOTENV_CONFIG_PATH;
  if (customPath) {
    return customPath;
  }

  const rootEnvPath = path.resolve(currentDir, "../../..", ".env");
  if (fs.existsSync(rootEnvPath)) {
    return rootEnvPath;
  }

  return undefined;
};

const envPath = resolveEnvPath();
loadEnv(envPath ? { path: envPath } : undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_VERSION: z.string().min(1).default("0.0.1"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  IDENTITY_JWT_SECRET: z.string().min(32),
  IDENTITY_JWT_KID: z.string().default("identity-hs256"),
  IDENTITY_ISSUER: z.string().url().default("http://localhost:4000"),
  IDENTITY_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  IDENTITY_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  IDENTITY_AUTHORIZATION_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(120),
  IDENTITY_COOKIE_DOMAIN: z.string().default("localhost"),
  API_CORS_ORIGINS: z.string().optional(),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  E2E_BYPASS_RATE_LIMIT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true")
});

export type AppEnvironment = z.infer<typeof envSchema>;

let cachedEnv: AppEnvironment | null = null;

export const getEnv = (): AppEnvironment => {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.parse({
    NODE_ENV: process.env.NODE_ENV ?? "development",
    APP_VERSION: process.env.APP_VERSION ?? "0.0.1",
    APP_BASE_URL: process.env.APP_BASE_URL ?? "http://localhost:3000",
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
    IDENTITY_JWT_SECRET: process.env.IDENTITY_JWT_SECRET,
    IDENTITY_JWT_KID: process.env.IDENTITY_JWT_KID ?? "identity-hs256",
    IDENTITY_ISSUER: process.env.IDENTITY_ISSUER ?? "http://localhost:4000",
    IDENTITY_ACCESS_TOKEN_TTL_SECONDS: process.env.IDENTITY_ACCESS_TOKEN_TTL_SECONDS ?? "300",
    IDENTITY_REFRESH_TOKEN_TTL_SECONDS:
      process.env.IDENTITY_REFRESH_TOKEN_TTL_SECONDS ?? "2592000",
    IDENTITY_AUTHORIZATION_CODE_TTL_SECONDS:
      process.env.IDENTITY_AUTHORIZATION_CODE_TTL_SECONDS ?? "120",
    IDENTITY_COOKIE_DOMAIN: process.env.IDENTITY_COOKIE_DOMAIN ?? "localhost",
    API_CORS_ORIGINS: process.env.API_CORS_ORIGINS,
    TRUST_PROXY: process.env.TRUST_PROXY ?? "false",
    E2E_BYPASS_RATE_LIMIT: process.env.E2E_BYPASS_RATE_LIMIT ?? "false"
  });

  cachedEnv = parsed;

  return parsed;
};

export const env: AppEnvironment = new Proxy({} as AppEnvironment, {
  get: (_target, prop: keyof AppEnvironment) => {
    const value = getEnv()[prop];
    return value;
  }
});

export const resetEnvCache = (): void => {
  cachedEnv = null;
};
