const NON_WORD_REGEX = /[^a-z0-9]+/gi;
const EDGE_DASH_REGEX = /^-+|-+$/g;

export const slugify = (input: string): string => {
  return input
    .toLowerCase()
    .replace(NON_WORD_REGEX, "-")
    .replace(EDGE_DASH_REGEX, "")
    .slice(0, 60);
};
