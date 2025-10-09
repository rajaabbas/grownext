import pino from "pino";
import type { Logger, LoggerOptions } from "pino";
import { env } from "./env";

const createDefaultOptions = (): LoggerOptions => {
  const base: LoggerOptions = {
    name: "ma-boilerplate",
    level: env.NODE_ENV === "production" ? "info" : "debug",
    base: {
      appVersion: env.APP_VERSION
    }
  };

  if (env.NODE_ENV !== "production") {
    return {
      ...base,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          singleLine: true,
          translateTime: "SYS:standard"
        }
      }
    };
  }

  return base;
};

const createLogger = (options: LoggerOptions): Logger =>
  (pino as unknown as (opts: LoggerOptions) => Logger)(options);

export const logger = createLogger(createDefaultOptions());
