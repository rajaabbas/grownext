import { randomBytes } from "node:crypto";

const NON_WORD_REGEX = /[^a-z0-9]+/gi;
const EDGE_DASH_REGEX = /^-+|-+$/g;
const MAX_SLUG_LENGTH = 60;
const RANDOM_SUFFIX_LENGTH = 6;

export const slugify = (input: string): string => {
  return input
    .toLowerCase()
    .replace(NON_WORD_REGEX, "-")
    .replace(EDGE_DASH_REGEX, "")
    .slice(0, MAX_SLUG_LENGTH);
};

const randomSuffix = (): string => {
  const candidate = randomBytes(4).toString("base64url").replace(NON_WORD_REGEX, "");
  const cleaned = candidate.toLowerCase().slice(0, RANDOM_SUFFIX_LENGTH);

  if (cleaned.length === RANDOM_SUFFIX_LENGTH) {
    return cleaned;
  }

  const fallback = Math.random().toString(36).slice(2, 2 + RANDOM_SUFFIX_LENGTH);
  return fallback.padEnd(RANDOM_SUFFIX_LENGTH, "0");
};

export const generateTenantSlug = (name: string): string => {
  const base = slugify(name) || "tenant";
  const suffix = randomSuffix();
  return slugify(`${base}-${suffix}`);
};
