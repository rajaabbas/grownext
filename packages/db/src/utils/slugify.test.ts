import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("normalises strings to lowercase dash separated tokens", () => {
    expect(slugify("Tasks Workspace")).toBe("tasks-workspace");
  });

  it("strips non alphanumeric characters", () => {
    expect(slugify("Portal@GrowNext!")).toBe("portal-grownext");
  });
});
