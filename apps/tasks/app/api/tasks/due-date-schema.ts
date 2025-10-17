import { z } from "zod";

/**
 * Normalizes date input coming from the client so plain `YYYY-MM-DD` strings are accepted.
 * Returns an ISO8601 string, `null`, or `undefined` so downstream Zod validation stays strict.
 */
export const dueDateSchema = z.preprocess(
  (value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return null;
      }

      const parsed = Date.parse(trimmed);
      if (Number.isNaN(parsed)) {
        return trimmed;
      }

      return new Date(parsed).toISOString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return value;
  },
  z.string().datetime().nullable().optional()
);

export type DueDateInput = z.infer<typeof dueDateSchema>;
