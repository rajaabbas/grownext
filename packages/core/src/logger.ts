import pino from "pino";
import type { Logger, LoggerOptions } from "pino";
import { env } from "./env";

const createDefaultOptions = (): LoggerOptions => {
  return {
    name: "grownext",
    level: env.NODE_ENV === "production" ? "info" : "debug",
    base: {
      appVersion: env.APP_VERSION
    }
  };
};

const createLogger = (options: LoggerOptions): Logger =>
  (pino as unknown as (opts: LoggerOptions) => Logger)(options);

export const logger = createLogger(createDefaultOptions());
