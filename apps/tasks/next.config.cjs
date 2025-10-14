/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
