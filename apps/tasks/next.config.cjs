/** @type {import('next').NextConfig} */
const defaultSupabaseUrl = "https://example.supabase.co";
const defaultSupabaseAnonKey = "anon";

const nextConfig = {
  reactStrictMode: true,
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL ?? defaultSupabaseUrl,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? defaultSupabaseAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "service",
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? defaultSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? defaultSupabaseAnonKey,
    REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/identity",
    TASKS_DATABASE_URL:
      process.env.TASKS_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/tasks",
    SKIP_QUEUE_CONNECTION: process.env.SKIP_QUEUE_CONNECTION ?? "true"
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb"
    },
    serverComponentsExternalPackages: [
      "@ma/tasks-db",
      "@prisma/client",
      "@prisma/engines",
      "pino",
      "pino-pretty"
    ]
  },
  outputFileTracingIncludes: {
    "/**": [
      "../../packages/tasks-db/generated/client/**/*",
      "../../packages/tasks-db/prisma/**/*"
    ]
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.extensionAlias = {
      ".js": [".js", ".ts", ".tsx"],
      ".mjs": [".mjs", ".mts"],
      ".cjs": [".cjs", ".cts"]
    };
    return config;
  }
};

module.exports = nextConfig;
