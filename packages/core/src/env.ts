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

const defaultSupabaseUrl = "https://example.supabase.co";
const defaultSupabaseAnonKey = "anon";
const defaultServiceRoleKey = "service";
const defaultIdentityDbUrl = "postgresql://postgres:postgres@localhost:5432/identity";
const defaultTasksDbUrl = "postgresql://postgres:postgres@localhost:5432/tasks";
const defaultJwtSecret = "0123456789abcdef0123456789abcdef";
const defaultImpersonationSecret = "super-admin-impersonation-secret-0123456789";

const envSchema = z
  .object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_VERSION: z.string().min(1).default("0.0.1"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  TASKS_DATABASE_URL: z.string().min(1),
  TASKS_DATABASE_DIRECT_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  IDENTITY_JWT_SECRET: z.string().min(32).optional(),
  IDENTITY_JWT_PRIVATE_KEY: z.string().min(1).optional(),
  IDENTITY_JWT_PUBLIC_KEY: z.string().min(1).optional(),
  IDENTITY_JWT_ALG: z.enum(["HS256", "RS256"]).default("HS256"),
  IDENTITY_JWT_KID: z.string().default("identity-hs256"),
  IDENTITY_ISSUER: z.string().url().default("http://localhost:4000"),
  IDENTITY_SAML_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  IDENTITY_SAML_SP_ENTITY_ID: z.string().min(1).default("http://localhost:4000/saml/sp"),
  IDENTITY_SAML_SP_SIGNING_PRIVATE_KEY: z.string().min(1).optional(),
  IDENTITY_SAML_SP_SIGNING_CERT: z.string().min(1).optional(),
  IDENTITY_SAML_NAMEID_FORMAT: z
    .string()
    .min(1)
    .default("urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"),
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
    .transform((value) => value === "true"),
  SUPER_ADMIN_IMPERSONATION_SECRET: z.string().min(16).default(defaultImpersonationSecret)
  })
  .superRefine((data, ctx) => {
    const hasSecret = typeof data.IDENTITY_JWT_SECRET === "string";
    const hasPrivateKey = typeof data.IDENTITY_JWT_PRIVATE_KEY === "string";

    if (!hasSecret && !hasPrivateKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["IDENTITY_JWT_SECRET"],
        message:
          "Provide IDENTITY_JWT_SECRET for HS256 or IDENTITY_JWT_PRIVATE_KEY for RS256 token signing."
      });
    }

    if (data.IDENTITY_JWT_ALG === "HS256" && !hasSecret && !hasPrivateKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["IDENTITY_JWT_ALG"],
        message: "HS256 requires IDENTITY_JWT_SECRET."
      });
    }

    if (data.IDENTITY_JWT_ALG === "RS256" && !hasPrivateKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["IDENTITY_JWT_ALG"],
        message: "RS256 requires IDENTITY_JWT_PRIVATE_KEY."
      });
    }

    if (
      data.IDENTITY_SAML_ENABLED &&
      (!data.IDENTITY_SAML_SP_SIGNING_PRIVATE_KEY || !data.IDENTITY_SAML_SP_SIGNING_CERT)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["IDENTITY_SAML_SP_SIGNING_PRIVATE_KEY"],
        message: "SAML SP signing key and certificate are required."
      });
    }
  });

export type AppEnvironment = z.infer<typeof envSchema>;

let cachedEnv: AppEnvironment | null = null;

export const getEnv = (): AppEnvironment => {
  if (cachedEnv) {
    return cachedEnv;
  }

  const resolvedSupabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_PROJECT_URL ??
    defaultSupabaseUrl;

  const resolvedSupabaseAnon =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    defaultSupabaseAnonKey;

  const resolvedServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? defaultServiceRoleKey;

  const resolvedDatabaseUrl = process.env.DATABASE_URL ?? defaultIdentityDbUrl;
  const resolvedTasksDatabaseUrl =
    process.env.TASKS_DATABASE_URL ?? resolvedDatabaseUrl ?? defaultTasksDbUrl;

  const resolvedJwtSecret =
    process.env.IDENTITY_JWT_SECRET ??
    (process.env.IDENTITY_JWT_PRIVATE_KEY ? undefined : defaultJwtSecret);

  const parsed = envSchema.parse({
    NODE_ENV: process.env.NODE_ENV ?? "development",
    APP_VERSION: process.env.APP_VERSION ?? "0.0.1",
    APP_BASE_URL: process.env.APP_BASE_URL ?? "http://localhost:3000",
    SUPABASE_URL: resolvedSupabaseUrl,
    SUPABASE_ANON_KEY: resolvedSupabaseAnon,
    SUPABASE_SERVICE_ROLE_KEY: resolvedServiceRoleKey,
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? resolvedSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? resolvedSupabaseAnon,
    DATABASE_URL: resolvedDatabaseUrl,
    TASKS_DATABASE_URL: resolvedTasksDatabaseUrl,
    TASKS_DATABASE_DIRECT_URL: process.env.TASKS_DATABASE_DIRECT_URL,
    REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
    IDENTITY_JWT_SECRET: resolvedJwtSecret,
    IDENTITY_JWT_PRIVATE_KEY: process.env.IDENTITY_JWT_PRIVATE_KEY,
    IDENTITY_JWT_PUBLIC_KEY: process.env.IDENTITY_JWT_PUBLIC_KEY,
    IDENTITY_JWT_ALG:
      process.env.IDENTITY_JWT_ALG ??
      (process.env.IDENTITY_JWT_PRIVATE_KEY ? "RS256" : "HS256"),
    IDENTITY_JWT_KID: process.env.IDENTITY_JWT_KID ?? "identity-hs256",
    IDENTITY_ISSUER: process.env.IDENTITY_ISSUER ?? "http://localhost:4000",
    IDENTITY_SAML_ENABLED: process.env.IDENTITY_SAML_ENABLED ?? "false",
    IDENTITY_SAML_SP_ENTITY_ID:
      process.env.IDENTITY_SAML_SP_ENTITY_ID ??
      `${process.env.IDENTITY_ISSUER ?? "http://localhost:4000"}/saml/sp`,
    IDENTITY_SAML_SP_SIGNING_PRIVATE_KEY: process.env.IDENTITY_SAML_SP_SIGNING_PRIVATE_KEY,
    IDENTITY_SAML_SP_SIGNING_CERT: process.env.IDENTITY_SAML_SP_SIGNING_CERT,
    IDENTITY_SAML_NAMEID_FORMAT:
      process.env.IDENTITY_SAML_NAMEID_FORMAT ??
      "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    IDENTITY_ACCESS_TOKEN_TTL_SECONDS: process.env.IDENTITY_ACCESS_TOKEN_TTL_SECONDS ?? "300",
    IDENTITY_REFRESH_TOKEN_TTL_SECONDS:
      process.env.IDENTITY_REFRESH_TOKEN_TTL_SECONDS ?? "2592000",
    IDENTITY_AUTHORIZATION_CODE_TTL_SECONDS:
      process.env.IDENTITY_AUTHORIZATION_CODE_TTL_SECONDS ?? "120",
    IDENTITY_COOKIE_DOMAIN: process.env.IDENTITY_COOKIE_DOMAIN ?? "localhost",
    API_CORS_ORIGINS: process.env.API_CORS_ORIGINS,
    TRUST_PROXY: process.env.TRUST_PROXY ?? "false",
    E2E_BYPASS_RATE_LIMIT: process.env.E2E_BYPASS_RATE_LIMIT ?? "false",
    SUPER_ADMIN_IMPERSONATION_SECRET:
      process.env.SUPER_ADMIN_IMPERSONATION_SECRET ?? defaultImpersonationSecret
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
